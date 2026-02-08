from __future__ import annotations

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_me_unauthenticated(client: AsyncClient):
    resp = await client.get("/admin/me")
    assert resp.status_code == 422  # missing authorization header


@pytest.mark.asyncio
async def test_me_authenticated(client: AsyncClient, seed_tenant: dict):
    resp = await client.get(
        "/admin/me",
        headers={"Authorization": f"Bearer {seed_tenant['token']}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["email"] == "admin@testhotel.com"
    assert len(data["tenants"]) == 1


@pytest.mark.asyncio
async def test_get_tenant_settings(client: AsyncClient, seed_tenant: dict):
    resp = await client.get(
        f"/admin/tenant/{seed_tenant['tenant_id']}/settings",
        headers={"Authorization": f"Bearer {seed_tenant['token']}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["greeting_message"] == "Welcome to Test Hotel!"


@pytest.mark.asyncio
async def test_create_widget_key(client: AsyncClient, seed_tenant: dict):
    resp = await client.post(
        f"/admin/tenant/{seed_tenant['tenant_id']}/widget-keys",
        headers={"Authorization": f"Bearer {seed_tenant['token']}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["key"].startswith("wk_")
    assert data["status"] == "active"
