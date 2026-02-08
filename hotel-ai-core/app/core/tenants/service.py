from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.models import Tenant, TenantSetting


async def get_tenant(db: AsyncSession, tenant_id: uuid.UUID) -> Tenant | None:
    stmt = select(Tenant).options(selectinload(Tenant.settings)).where(Tenant.id == tenant_id)
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def get_tenant_settings(db: AsyncSession, tenant_id: uuid.UUID) -> TenantSetting | None:
    stmt = select(TenantSetting).where(TenantSetting.tenant_id == tenant_id)
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def upsert_tenant_settings(
    db: AsyncSession, tenant_id: uuid.UUID, data: dict
) -> TenantSetting:
    existing = await get_tenant_settings(db, tenant_id)
    if existing:
        for k, v in data.items():
            if hasattr(existing, k):
                setattr(existing, k, v)
        return existing
    else:
        ts = TenantSetting(tenant_id=tenant_id, **data)
        db.add(ts)
        await db.flush()
        return ts
