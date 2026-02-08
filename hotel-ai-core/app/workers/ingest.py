from __future__ import annotations

import io
import uuid

import structlog
from sqlalchemy import create_engine, delete
from sqlalchemy.orm import Session

from app.config import settings
from app.core.kb.chunking import chunk_text
from app.core.kb.service import get_s3_client
from app.db.models import Base, KBChunk, KBDocument, KBEmbedding
from app.workers.celery_app import celery

logger = structlog.get_logger()

# Sync engine for Celery tasks (Celery doesn't support async natively)
sync_engine = create_engine(settings.DATABASE_URL_SYNC, pool_pre_ping=True)


def _download_from_s3(storage_url: str) -> bytes:
    """Download file bytes from S3 storage URL."""
    # Parse s3://bucket/key format
    parts = storage_url.replace("s3://", "").split("/", 1)
    bucket = parts[0]
    key = parts[1]

    client = get_s3_client()
    response = client.get_object(Bucket=bucket, Key=key)
    return response["Body"].read()


def _parse_document(file_bytes: bytes, source_type: str) -> str:
    """Parse document to text based on source type."""
    if source_type == "pdf":
        from pypdf import PdfReader

        reader = PdfReader(io.BytesIO(file_bytes))
        return "\n".join(page.extract_text() or "" for page in reader.pages)
    elif source_type == "text":
        return file_bytes.decode("utf-8")
    else:
        return file_bytes.decode("utf-8", errors="replace")


def _embed_texts_sync(texts: list[str]) -> list[list[float]]:
    """Synchronous embedding call for use in Celery tasks."""
    from openai import OpenAI

    client = OpenAI(api_key=settings.OPENAI_API_KEY)
    # Process in batches of 100 to respect API limits
    all_embeddings = []
    for i in range(0, len(texts), 100):
        batch = texts[i : i + 100]
        resp = client.embeddings.create(input=batch, model=settings.OPENAI_EMBEDDING_MODEL)
        all_embeddings.extend([item.embedding for item in resp.data])
    return all_embeddings


@celery.task(bind=True, max_retries=3, default_retry_delay=60)
def process_document(self, document_id: str, tenant_id: str) -> dict:
    """Ingest a document: download → parse → chunk → embed → store.

    Idempotent: existing chunks for the document are deleted before re-inserting.
    """
    doc_uuid = uuid.UUID(document_id)
    tenant_uuid = uuid.UUID(tenant_id)

    logger.info("ingest.start", document_id=document_id, tenant_id=tenant_id)

    with Session(sync_engine) as db:
        try:
            # 1. Get document
            doc = db.get(KBDocument, doc_uuid)
            if not doc:
                logger.error("ingest.doc_not_found", document_id=document_id)
                return {"status": "error", "detail": "Document not found"}

            # 2. Download from S3
            file_bytes = _download_from_s3(doc.storage_url)
            logger.info("ingest.downloaded", size=len(file_bytes))

            # 3. Parse to text
            text = _parse_document(file_bytes, doc.source_type)
            logger.info("ingest.parsed", text_length=len(text))

            # 4. Chunk
            chunks = chunk_text(text)
            logger.info("ingest.chunked", chunk_count=len(chunks))

            # 5. Embed
            chunk_texts = [c["chunk_text"] for c in chunks]
            embeddings = _embed_texts_sync(chunk_texts)
            logger.info("ingest.embedded", embedding_count=len(embeddings))

            # 6. Delete existing chunks (idempotent reindex)
            db.execute(delete(KBChunk).where(KBChunk.document_id == doc_uuid))

            # 7. Insert new chunks + embeddings
            for chunk_data, embedding in zip(chunks, embeddings):
                chunk_obj = KBChunk(
                    tenant_id=tenant_uuid,
                    document_id=doc_uuid,
                    chunk_text=chunk_data["chunk_text"],
                    chunk_hash=chunk_data["chunk_hash"],
                )
                db.add(chunk_obj)
                db.flush()

                emb_obj = KBEmbedding(
                    chunk_id=chunk_obj.id,
                    tenant_id=tenant_uuid,
                    embedding=embedding,
                )
                db.add(emb_obj)

            # 8. Mark document as ready
            doc.status = "ready"
            db.commit()

            logger.info("ingest.complete", document_id=document_id, chunks=len(chunks))
            return {"status": "ready", "chunks": len(chunks)}

        except Exception as exc:
            db.rollback()
            doc = db.get(KBDocument, doc_uuid)
            if doc:
                doc.status = "failed"
                db.commit()
            logger.error("ingest.failed", document_id=document_id, error=str(exc))
            raise self.retry(exc=exc)
