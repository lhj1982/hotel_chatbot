from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import settings
from app.db.models import Conversation, Message, Turn, WidgetKey
from app.db.session import get_db
from app.core.rag.orchestrator import rag_answer

router = APIRouter(prefix="/public", tags=["public"])

limiter = Limiter(key_func=get_remote_address, storage_uri=settings.REDIS_URL)


# ── Schemas ──────────────────────────────────────────────────────────────────


class ConversationStartRequest(BaseModel):
    widget_key: str
    channel: str = "web_widget"
    locale: str | None = None
    page_url: str | None = None


class ConversationStartResponse(BaseModel):
    conversation_id: str


class ChatRequest(BaseModel):
    widget_key: str
    conversation_id: str
    message: str
    locale: str | None = None


class ChatResponse(BaseModel):
    outcome: str
    answer_text: str | None = None
    citations: list[dict] = []
    confidence: float
    escalation: dict | None = None


# ── Helpers ──────────────────────────────────────────────────────────────────


async def _resolve_widget_key(
    db: AsyncSession, widget_key: str, request: Request
) -> WidgetKey:
    stmt = select(WidgetKey).where(WidgetKey.key == widget_key, WidgetKey.status == "active")
    result = await db.execute(stmt)
    wk = result.scalar_one_or_none()
    if not wk:
        raise HTTPException(status_code=404, detail="Invalid or inactive widget key")

    # Domain validation
    from app.core.tenants.service import get_tenant_settings

    ts = await get_tenant_settings(db, wk.tenant_id)
    if ts and ts.allowed_domains:
        origin = request.headers.get("origin") or request.headers.get("referer") or ""
        if origin and not any(domain in origin for domain in ts.allowed_domains):
            raise HTTPException(status_code=403, detail="Domain not allowed")

    return wk


# ── Endpoints ────────────────────────────────────────────────────────────────


@router.get("/widget-config")
async def widget_config(
    widget_key: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    wk = await _resolve_widget_key(db, widget_key, request)

    from app.core.tenants.service import get_tenant, get_tenant_settings

    tenant = await get_tenant(db, wk.tenant_id)
    ts = await get_tenant_settings(db, wk.tenant_id)

    return {
        "greeting_message": ts.greeting_message if ts else None,
        "escalation_phone": ts.escalation_phone if ts else None,
        "escalation_email": ts.escalation_email if ts else None,
        "supported_languages": [tenant.default_language] if tenant else ["en"],
    }


@router.post("/conversation/start", response_model=ConversationStartResponse)
async def conversation_start(
    body: ConversationStartRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    wk = await _resolve_widget_key(db, body.widget_key, request)

    conv = Conversation(
        tenant_id=wk.tenant_id,
        channel=body.channel,
        status="active",
    )
    db.add(conv)
    await db.flush()

    return ConversationStartResponse(conversation_id=str(conv.id))


@router.post("/chat", response_model=ChatResponse)
async def chat(
    body: ChatRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    wk = await _resolve_widget_key(db, body.widget_key, request)
    tenant_id = wk.tenant_id

    # Validate conversation belongs to tenant
    conv_stmt = select(Conversation).where(
        Conversation.id == uuid.UUID(body.conversation_id),
        Conversation.tenant_id == tenant_id,
    )
    result = await db.execute(conv_stmt)
    conv = result.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    # Save user message
    user_msg = Message(
        tenant_id=tenant_id,
        conversation_id=conv.id,
        role="user",
        content=body.message,
    )
    db.add(user_msg)
    await db.flush()

    # Get escalation info
    from app.core.tenants.service import get_tenant_settings

    ts = await get_tenant_settings(db, tenant_id)
    escalation_phone = ts.escalation_phone if ts else None
    escalation_email = ts.escalation_email if ts else None
    greeting_message = ts.greeting_message if ts else None

    # RAG pipeline
    rag_result = await rag_answer(
        db, tenant_id, body.message,
        escalation_phone=escalation_phone,
        escalation_email=escalation_email,
        greeting_message=greeting_message,
    )

    # Save assistant message
    assistant_msg = Message(
        tenant_id=tenant_id,
        conversation_id=conv.id,
        role="assistant",
        content=rag_result.get("answer_text"),
    )
    print(assistant_msg.content)
    db.add(assistant_msg)
    await db.flush()

    # Save turn
    turn = Turn(
        tenant_id=tenant_id,
        conversation_id=conv.id,
        user_message_id=user_msg.id,
        assistant_message_id=assistant_msg.id,
        outcome=rag_result["outcome"],
        confidence=rag_result["confidence"],
        retrieved_chunk_ids=[c["chunk_id"] for c in rag_result.get("citations", [])],
    )
    db.add(turn)

    return ChatResponse(**rag_result)
