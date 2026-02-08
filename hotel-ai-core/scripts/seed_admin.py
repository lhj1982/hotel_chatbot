"""Seed a test admin user + tenant for local development."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import uuid
from sqlalchemy import create_engine, text
from app.core.auth.passwords import hash_password
from app.config import settings

DATABASE_URL = str(settings.DATABASE_URL_SYNC) if hasattr(settings, "DATABASE_URL_SYNC") else str(settings.DATABASE_URL).replace("+asyncpg", "")

engine = create_engine(DATABASE_URL)

TENANT_ID = uuid.uuid4()
USER_ID = uuid.uuid4()
EMAIL = "test@test.com"
PASSWORD = "test"

with engine.begin() as conn:
    # Check if user already exists
    existing = conn.execute(text("SELECT id FROM users WHERE email = :email"), {"email": EMAIL}).fetchone()
    if existing:
        print(f"User {EMAIL} already exists (id={existing[0]}). Skipping.")
    else:
        pw_hash = hash_password(PASSWORD)

        # Create tenant
        conn.execute(
            text("""
                INSERT INTO tenants (id, name, slug, status, default_language)
                VALUES (:id, :name, :slug, 'active', 'en')
            """),
            {"id": str(TENANT_ID), "name": "Test Hotel", "slug": "test-hotel"},
        )

        # Create tenant settings
        conn.execute(
            text("""
                INSERT INTO tenant_settings (tenant_id, greeting_message, escalation_email, retention_days)
                VALUES (:tid, :greeting, :email, 90)
            """),
            {"tid": str(TENANT_ID), "greeting": "Welcome to Test Hotel! How can I help you?", "email": "support@testhotel.com"},
        )

        # Create user
        conn.execute(
            text("""
                INSERT INTO users (id, email, password_hash)
                VALUES (:id, :email, :pw)
            """),
            {"id": str(USER_ID), "email": EMAIL, "pw": pw_hash},
        )

        # Link user to tenant as owner
        conn.execute(
            text("""
                INSERT INTO tenant_user_roles (tenant_id, user_id, role)
                VALUES (:tid, :uid, 'owner')
            """),
            {"tid": str(TENANT_ID), "uid": str(USER_ID)},
        )

        print(f"Created tenant 'Test Hotel' (id={TENANT_ID})")
        print(f"Created user {EMAIL} (id={USER_ID}) with role=owner")
        print(f"Login: email={EMAIL}, password={PASSWORD}")
