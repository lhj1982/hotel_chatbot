from __future__ import annotations

import asyncio
import uuid
from collections.abc import AsyncGenerator

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import settings
from app.db.models import Base, Tenant, TenantSetting, User, TenantUserRole, WidgetKey
from app.db.session import get_db
from app.core.auth.passwords import hash_password
from app.core.auth.jwt import create_access_token
from app.main import app


# Use a separate test database if configured, otherwise use main DB
TEST_DATABASE_URL = settings.DATABASE_URL

test_engine = create_async_engine(TEST_DATABASE_URL, echo=False)
test_session = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)


@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture
async def db() -> AsyncGenerator[AsyncSession, None]:
    async with test_session() as session:
        yield session
        await session.rollback()


@pytest_asyncio.fixture
async def client(db: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    async def override_get_db():
        yield db

    app.dependency_overrides[get_db] = override_get_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def seed_tenant(db: AsyncSession) -> dict:
    """Create a test tenant with settings, user, role, and widget key."""
    tenant = Tenant(name="Test Hotel", slug="test-hotel", status="active")
    db.add(tenant)
    await db.flush()

    ts = TenantSetting(
        tenant_id=tenant.id,
        greeting_message="Welcome to Test Hotel!",
        escalation_phone="+1234567890",
        escalation_email="help@testhotel.com",
    )
    db.add(ts)

    user = User(email="admin@testhotel.com", password_hash=hash_password("testpass123"))
    db.add(user)
    await db.flush()

    role = TenantUserRole(tenant_id=tenant.id, user_id=user.id, role="owner")
    db.add(role)

    wk = WidgetKey(tenant_id=tenant.id, key="wk_test_key_12345", status="active")
    db.add(wk)
    await db.flush()

    token = create_access_token({"sub": str(user.id)})

    return {
        "tenant_id": str(tenant.id),
        "user_id": str(user.id),
        "widget_key": wk.key,
        "token": token,
    }
