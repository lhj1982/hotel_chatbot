from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import TenantUserRole

ROLE_HIERARCHY = {"owner": 3, "editor": 2, "viewer": 1}


async def check_tenant_access(
    db: AsyncSession, user_id: uuid.UUID, tenant_id: uuid.UUID, min_role: str = "viewer"
) -> TenantUserRole | None:
    stmt = select(TenantUserRole).where(
        TenantUserRole.user_id == user_id,
        TenantUserRole.tenant_id == tenant_id,
    )
    result = await db.execute(stmt)
    role_obj = result.scalar_one_or_none()
    if role_obj is None:
        return None
    if ROLE_HIERARCHY.get(role_obj.role, 0) < ROLE_HIERARCHY.get(min_role, 0):
        return None
    return role_obj
