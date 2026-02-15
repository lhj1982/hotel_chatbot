from __future__ import annotations

import uuid

import boto3
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db.models import KBDocument


def get_s3_client():
    kwargs = {
        "aws_access_key_id": settings.S3_ACCESS_KEY,
        "aws_secret_access_key": settings.S3_SECRET_KEY,
        "region_name": settings.S3_REGION,
    }
    if settings.S3_ENDPOINT_URL:
        kwargs["endpoint_url"] = settings.S3_ENDPOINT_URL
    return boto3.client("s3", **kwargs)


async def create_document(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    title: str,
    source_type: str,
    storage_url: str | None = None,
) -> KBDocument:
    doc = KBDocument(
        tenant_id=tenant_id,
        title=title,
        source_type=source_type,
        storage_url=storage_url,
        status="processing",
    )
    db.add(doc)
    await db.flush()
    return doc


async def list_documents(db: AsyncSession, tenant_id: uuid.UUID) -> list[KBDocument]:
    stmt = select(KBDocument).where(KBDocument.tenant_id == tenant_id).order_by(KBDocument.created_at.desc())
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def get_document(db: AsyncSession, tenant_id: uuid.UUID, doc_id: uuid.UUID) -> KBDocument | None:
    stmt = select(KBDocument).where(KBDocument.tenant_id == tenant_id, KBDocument.id == doc_id)
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


def upload_file_to_s3(file_bytes: bytes, key: str) -> str:
    client = get_s3_client()
    client.put_object(Bucket=settings.S3_BUCKET_NAME, Key=key, Body=file_bytes)
    return f"s3://{settings.S3_BUCKET_NAME}/{key}"
