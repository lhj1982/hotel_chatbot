from __future__ import annotations

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_health(client: AsyncClient):
    resp = await client.get("/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


@pytest.mark.asyncio
async def test_widget_config_invalid_key(client: AsyncClient):
    resp = await client.get("/public/widget-config", params={"widget_key": "nonexistent"})
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_widget_config(client: AsyncClient, seed_tenant: dict):
    resp = await client.get(
        "/public/widget-config", params={"widget_key": seed_tenant["widget_key"]}
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["greeting_message"] == "Welcome to Test Hotel!"


@pytest.mark.asyncio
async def test_conversation_start(client: AsyncClient, seed_tenant: dict):
    resp = await client.post(
        "/public/conversation/start",
        json={"widget_key": seed_tenant["widget_key"], "channel": "web_widget"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "conversation_id" in data
