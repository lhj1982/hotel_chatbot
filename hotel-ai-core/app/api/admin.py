from __future__ import annotations

import uuid
from datetime import date, datetime

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user, require_tenant_role
from app.core.analytics.service import get_stats_overview, get_unanswered_turns
from app.core.auth.jwt import create_access_token
from app.core.auth.passwords import hash_password, verify_password
from app.core.kb.service import (
    create_document,
    get_document,
    list_documents,
    upload_file_to_s3,
)
from app.core.tenants.service import get_tenant, get_tenant_settings, upsert_tenant_settings
from app.db.models import (
    Conversation,
    KBDocument,
    Message,
    Tenant,
    TenantUserRole,
    User,
    WidgetKey,
)
from app.db.session import get_db

router = APIRouter(prefix="/admin", tags=["admin"])


# ── Schemas ──────────────────────────────────────────────────────────────────


class LoginRequest(BaseModel):
    email: str
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TenantSettingsUpdate(BaseModel):
    greeting_message: str | None = None
    escalation_phone: str | None = None
    escalation_email: str | None = None
    retention_days: int | None = None
    allowed_domains: list[str] | None = None


class WidgetKeyCreate(BaseModel):
    pass


class KBTextUpload(BaseModel):
    title: str
    content: str


# ── Auth ─────────────────────────────────────────────────────────────────────


@router.post("/login", response_model=LoginResponse)
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    stmt = select(User).where(User.email == body.email)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()
    if not user or not user.password_hash or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_access_token({"sub": str(user.id)})
    return LoginResponse(access_token=token)


# ── Me ───────────────────────────────────────────────────────────────────────


@router.get("/me")
async def me(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(TenantUserRole)
        .options(selectinload(TenantUserRole.tenant))
        .where(TenantUserRole.user_id == current_user.id)
    )
    result = await db.execute(stmt)
    roles = result.scalars().all()
    return {
        "id": str(current_user.id),
        "email": current_user.email,
        "tenants": [
            {"tenant_id": str(r.tenant_id), "name": r.tenant.name, "role": r.role}
            for r in roles
        ],
    }


# ── Tenant Settings ─────────────────────────────────────────────────────────


@router.get("/tenant/{tenant_id}/settings")
async def get_settings(
    tenant_id: uuid.UUID,
    _user: User = Depends(require_tenant_role("viewer")),
    db: AsyncSession = Depends(get_db),
):
    ts = await get_tenant_settings(db, tenant_id)
    if not ts:
        return {}
    return {
        "greeting_message": ts.greeting_message,
        "escalation_phone": ts.escalation_phone,
        "escalation_email": ts.escalation_email,
        "retention_days": ts.retention_days,
        "allowed_domains": ts.allowed_domains,
    }


@router.post("/tenant/{tenant_id}/settings")
async def update_settings(
    tenant_id: uuid.UUID,
    body: TenantSettingsUpdate,
    _user: User = Depends(require_tenant_role("editor")),
    db: AsyncSession = Depends(get_db),
):
    data = body.model_dump(exclude_unset=True)
    ts = await upsert_tenant_settings(db, tenant_id, data)
    return {"status": "ok"}


# ── Widget Keys ──────────────────────────────────────────────────────────────


@router.get("/tenant/{tenant_id}/widget-keys")
async def list_widget_keys(
    tenant_id: uuid.UUID,
    _user: User = Depends(require_tenant_role("viewer")),
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(WidgetKey)
        .where(WidgetKey.tenant_id == tenant_id)
        .order_by(WidgetKey.created_at.desc())
    )
    result = await db.execute(stmt)
    keys = result.scalars().all()
    return [
        {
            "id": str(wk.id),
            "key": wk.key,
            "status": wk.status,
            "created_at": wk.created_at.isoformat() if wk.created_at else None,
        }
        for wk in keys
    ]


@router.post("/tenant/{tenant_id}/widget-keys")
async def create_widget_key(
    tenant_id: uuid.UUID,
    _user: User = Depends(require_tenant_role("editor")),
    db: AsyncSession = Depends(get_db),
):
    import secrets

    wk = WidgetKey(
        tenant_id=tenant_id,
        key=f"wk_{secrets.token_urlsafe(32)}",
        status="active",
    )
    db.add(wk)
    await db.flush()
    return {"id": str(wk.id), "key": wk.key, "status": wk.status}


@router.post("/widget-keys/{widget_key_id}/disable")
async def disable_widget_key(
    widget_key_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(WidgetKey).where(WidgetKey.id == widget_key_id)
    result = await db.execute(stmt)
    wk = result.scalar_one_or_none()
    if not wk:
        raise HTTPException(status_code=404, detail="Widget key not found")

    from app.core.auth.rbac import check_tenant_access

    role = await check_tenant_access(db, current_user.id, wk.tenant_id, "editor")
    if not role:
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    wk.status = "disabled"
    return {"status": "disabled"}


# ── KB Management ────────────────────────────────────────────────────────────


@router.post("/tenant/{tenant_id}/kb/upload")
async def kb_upload(
    tenant_id: uuid.UUID,
    file: UploadFile = File(...),
    _user: User = Depends(require_tenant_role("editor")),
    db: AsyncSession = Depends(get_db),
):
    file_bytes = await file.read()
    key = f"{tenant_id}/{uuid.uuid4()}/{file.filename}"
    storage_url = upload_file_to_s3(file_bytes, key)

    doc = await create_document(
        db, tenant_id, title=file.filename or "Uploaded file", source_type="pdf", storage_url=storage_url
    )

    # Trigger async ingestion
    from app.workers.ingest import process_document

    process_document.delay(str(doc.id), str(tenant_id))

    return {"document_id": str(doc.id), "status": "processing"}


@router.post("/tenant/{tenant_id}/kb/text")
async def kb_text(
    tenant_id: uuid.UUID,
    body: KBTextUpload,
    _user: User = Depends(require_tenant_role("editor")),
    db: AsyncSession = Depends(get_db),
):
    doc = await create_document(db, tenant_id, title=body.title, source_type="text")

    # For text, we can process inline or via worker. Using worker for consistency.
    # Store text content as a file in S3
    key = f"{tenant_id}/{uuid.uuid4()}/{body.title}.txt"
    storage_url = upload_file_to_s3(body.content.encode(), key)
    doc.storage_url = storage_url

    from app.workers.ingest import process_document

    process_document.delay(str(doc.id), str(tenant_id))

    return {"document_id": str(doc.id), "status": "processing"}


@router.get("/tenant/{tenant_id}/kb/documents")
async def kb_list(
    tenant_id: uuid.UUID,
    _user: User = Depends(require_tenant_role("viewer")),
    db: AsyncSession = Depends(get_db),
):
    docs = await list_documents(db, tenant_id)
    return [
        {
            "id": str(d.id),
            "title": d.title,
            "source_type": d.source_type,
            "status": d.status,
            "created_at": d.created_at.isoformat(),
        }
        for d in docs
    ]


@router.get("/tenant/{tenant_id}/kb/documents/{doc_id}")
async def kb_detail(
    tenant_id: uuid.UUID,
    doc_id: uuid.UUID,
    _user: User = Depends(require_tenant_role("viewer")),
    db: AsyncSession = Depends(get_db),
):
    doc = await get_document(db, tenant_id, doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return {
        "id": str(doc.id),
        "title": doc.title,
        "source_type": doc.source_type,
        "status": doc.status,
        "storage_url": doc.storage_url,
        "created_at": doc.created_at.isoformat(),
    }


@router.post("/tenant/{tenant_id}/kb/reindex")
async def kb_reindex(
    tenant_id: uuid.UUID,
    doc_id: uuid.UUID | None = None,
    _user: User = Depends(require_tenant_role("editor")),
    db: AsyncSession = Depends(get_db),
):
    from app.workers.ingest import process_document

    if doc_id:
        doc = await get_document(db, tenant_id, doc_id)
        if not doc:
            raise HTTPException(status_code=404, detail="Document not found")
        doc.status = "processing"
        process_document.delay(str(doc.id), str(tenant_id))
        return {"status": "reindexing", "document_id": str(doc_id)}
    else:
        docs = await list_documents(db, tenant_id)
        for doc in docs:
            doc.status = "processing"
            process_document.delay(str(doc.id), str(tenant_id))
        return {"status": "reindexing", "document_count": len(docs)}


# ── Conversations & Analytics ────────────────────────────────────────────────


@router.get("/tenant/{tenant_id}/conversations")
async def list_conversations(
    tenant_id: uuid.UUID,
    from_date: date | None = None,
    to_date: date | None = None,
    _user: User = Depends(require_tenant_role("viewer")),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Conversation).where(Conversation.tenant_id == tenant_id)
    if from_date:
        stmt = stmt.where(Conversation.started_at >= datetime.combine(from_date, datetime.min.time()))
    if to_date:
        stmt = stmt.where(Conversation.started_at <= datetime.combine(to_date, datetime.max.time()))
    stmt = stmt.order_by(Conversation.started_at.desc()).limit(100)

    result = await db.execute(stmt)
    convs = result.scalars().all()
    return [
        {
            "id": str(c.id),
            "channel": c.channel,
            "status": c.status,
            "started_at": c.started_at.isoformat(),
            "ended_at": c.ended_at.isoformat() if c.ended_at else None,
        }
        for c in convs
    ]


@router.get("/tenant/{tenant_id}/conversations/{conversation_id}")
async def get_conversation(
    tenant_id: uuid.UUID,
    conversation_id: uuid.UUID,
    _user: User = Depends(require_tenant_role("viewer")),
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(Conversation)
        .options(selectinload(Conversation.messages), selectinload(Conversation.turns))
        .where(Conversation.tenant_id == tenant_id, Conversation.id == conversation_id)
    )
    result = await db.execute(stmt)
    conv = result.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    return {
        "id": str(conv.id),
        "channel": conv.channel,
        "status": conv.status,
        "started_at": conv.started_at.isoformat(),
        "ended_at": conv.ended_at.isoformat() if conv.ended_at else None,
        "messages": [
            {
                "id": str(m.id),
                "role": m.role,
                "content": m.content,
                "created_at": m.created_at.isoformat(),
            }
            for m in sorted(conv.messages, key=lambda m: m.created_at)
        ],
        "turns": [
            {
                "id": str(t.id),
                "outcome": t.outcome,
                "confidence": t.confidence,
                "created_at": t.created_at.isoformat(),
            }
            for t in sorted(conv.turns, key=lambda t: t.created_at)
        ],
    }


@router.get("/tenant/{tenant_id}/stats/overview")
async def stats_overview(
    tenant_id: uuid.UUID,
    from_date: date = date.today(),
    to_date: date = date.today(),
    _user: User = Depends(require_tenant_role("viewer")),
    db: AsyncSession = Depends(get_db),
):
    return await get_stats_overview(db, tenant_id, from_date, to_date)


@router.get("/tenant/{tenant_id}/stats/unanswered")
async def stats_unanswered(
    tenant_id: uuid.UUID,
    _user: User = Depends(require_tenant_role("viewer")),
    db: AsyncSession = Depends(get_db),
):
    return await get_unanswered_turns(db, tenant_id)
