from __future__ import annotations

import uuid
from datetime import date

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Conversation, DailyStat, Message, Turn


async def get_stats_overview(
    db: AsyncSession, tenant_id: uuid.UUID, from_date: date, to_date: date
) -> dict:
    stmt = (
        select(
            func.coalesce(func.sum(DailyStat.total_conversations), 0).label("total_conversations"),
            func.coalesce(func.sum(DailyStat.total_messages), 0).label("total_messages"),
            func.coalesce(func.sum(DailyStat.fallback_count), 0).label("fallback_count"),
            func.coalesce(func.sum(DailyStat.escalations), 0).label("escalations"),
        )
        .where(
            DailyStat.tenant_id == tenant_id,
            DailyStat.date >= from_date,
            DailyStat.date <= to_date,
        )
    )
    result = await db.execute(stmt)
    row = result.one()
    return {
        "total_conversations": row.total_conversations,
        "total_messages": row.total_messages,
        "fallback_count": row.fallback_count,
        "escalations": row.escalations,
    }


async def get_unanswered_turns(
    db: AsyncSession, tenant_id: uuid.UUID, limit: int = 50
) -> list[dict]:
    stmt = (
        select(
            Turn.id,
            Turn.conversation_id,
            Turn.confidence,
            Turn.created_at,
            Message.content.label("user_message"),
        )
        .join(Message, Message.id == Turn.user_message_id)
        .where(Turn.tenant_id == tenant_id, Turn.outcome.in_(["fallback", "escalate"]))
        .order_by(Turn.created_at.desc())
        .limit(limit)
    )
    result = await db.execute(stmt)
    rows = result.all()
    return [
        {
            "turn_id": str(row.id),
            "conversation_id": str(row.conversation_id),
            "user_message": row.user_message,
            "confidence": row.confidence,
            "created_at": row.created_at.isoformat(),
        }
        for row in rows
    ]
