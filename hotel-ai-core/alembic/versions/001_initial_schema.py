"""Initial schema

Revision ID: 001
Revises:
Create Date: 2026-02-08
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, ARRAY, JSONB
from pgvector.sqlalchemy import Vector

revision = "001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Enable pgvector extension
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    # tenants
    op.create_table(
        "tenants",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("slug", sa.String(255), unique=True, nullable=False),
        sa.Column("status", sa.Enum("active", "disabled", name="tenant_status"), server_default="active"),
        sa.Column("default_language", sa.String(10), server_default="en"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # tenant_settings
    op.create_table(
        "tenant_settings",
        sa.Column("tenant_id", UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("greeting_message", sa.Text),
        sa.Column("escalation_phone", sa.String(50)),
        sa.Column("escalation_email", sa.String(255)),
        sa.Column("retention_days", sa.Integer, server_default="90"),
        sa.Column("allowed_domains", ARRAY(sa.Text)),
    )

    # widget_keys
    op.create_table(
        "widget_keys",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("key", sa.String(255), unique=True, nullable=False),
        sa.Column("status", sa.Enum("active", "disabled", name="widget_key_status"), server_default="active"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # users
    op.create_table(
        "users",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("email", sa.String(255), unique=True, nullable=False),
        sa.Column("password_hash", sa.Text),
        sa.Column("oidc_subject", sa.String(255)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # tenant_user_roles
    op.create_table(
        "tenant_user_roles",
        sa.Column("tenant_id", UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("role", sa.Enum("owner", "editor", "viewer", name="user_role"), nullable=False),
    )

    # kb_documents
    op.create_table(
        "kb_documents",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("source_type", sa.Enum("pdf", "text", "url", name="kb_source_type"), nullable=False),
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("status", sa.Enum("processing", "ready", "failed", name="kb_doc_status"), server_default="processing"),
        sa.Column("storage_url", sa.Text),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # kb_chunks
    op.create_table(
        "kb_chunks",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("document_id", UUID(as_uuid=True), sa.ForeignKey("kb_documents.id", ondelete="CASCADE"), nullable=False),
        sa.Column("chunk_text", sa.Text, nullable=False),
        sa.Column("chunk_hash", sa.String(64), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # kb_embeddings
    op.create_table(
        "kb_embeddings",
        sa.Column("chunk_id", UUID(as_uuid=True), sa.ForeignKey("kb_chunks.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("tenant_id", UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("embedding", Vector(1536), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # HNSW index for fast cosine similarity search
    op.execute(
        "CREATE INDEX ix_kb_embeddings_hnsw ON kb_embeddings "
        "USING hnsw (embedding vector_cosine_ops) "
        "WITH (m = 16, ef_construction = 64)"
    )

    # conversations
    op.create_table(
        "conversations",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("channel", sa.Enum("web_widget", "web_url", "whatsapp", name="conv_channel"), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("ended_at", sa.DateTime(timezone=True)),
        sa.Column("status", sa.Enum("active", "closed", "escalated", name="conv_status"), server_default="active"),
    )

    # messages
    op.create_table(
        "messages",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("conversation_id", UUID(as_uuid=True), sa.ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("role", sa.Enum("user", "assistant", "system", name="msg_role"), nullable=False),
        sa.Column("content", sa.Text),
        sa.Column("redacted_content", sa.Text),
        sa.Column("token_count", sa.Integer),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # turns
    op.create_table(
        "turns",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("conversation_id", UUID(as_uuid=True), sa.ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_message_id", UUID(as_uuid=True), sa.ForeignKey("messages.id"), nullable=False),
        sa.Column("assistant_message_id", UUID(as_uuid=True), sa.ForeignKey("messages.id"), nullable=False),
        sa.Column("outcome", sa.Enum("answered", "fallback", "escalate", name="turn_outcome"), nullable=False),
        sa.Column("confidence", sa.Float),
        sa.Column("retrieved_chunk_ids", JSONB),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # daily_stats
    op.create_table(
        "daily_stats",
        sa.Column("tenant_id", UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("date", sa.Date, primary_key=True),
        sa.Column("total_conversations", sa.Integer, server_default="0"),
        sa.Column("total_messages", sa.Integer, server_default="0"),
        sa.Column("fallback_count", sa.Integer, server_default="0"),
        sa.Column("escalations", sa.Integer, server_default="0"),
    )


def downgrade() -> None:
    op.drop_table("daily_stats")
    op.drop_table("turns")
    op.drop_table("messages")
    op.drop_table("conversations")
    op.execute("DROP INDEX IF EXISTS ix_kb_embeddings_hnsw")
    op.drop_table("kb_embeddings")
    op.drop_table("kb_chunks")
    op.drop_table("kb_documents")
    op.drop_table("tenant_user_roles")
    op.drop_table("users")
    op.drop_table("widget_keys")
    op.drop_table("tenant_settings")
    op.drop_table("tenants")

    # Drop enums
    for enum_name in [
        "tenant_status", "widget_key_status", "user_role", "kb_source_type",
        "kb_doc_status", "conv_channel", "conv_status", "msg_role", "turn_outcome",
    ]:
        op.execute(f"DROP TYPE IF EXISTS {enum_name}")

    op.execute("DROP EXTENSION IF EXISTS vector")
