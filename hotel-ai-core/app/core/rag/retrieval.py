from __future__ import annotations

import uuid

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db.models import KBChunk, KBDocument, KBEmbedding


async def search_similar_chunks(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    query_embedding: list[float],
    top_k: int | None = None,
) -> list[dict]:
    """Vector similarity search scoped to tenant. Returns list of {chunk_id, document_id, title, chunk_text, similarity}."""
    k = top_k or settings.RAG_TOP_K

    # Use pgvector cosine distance operator <=>
    stmt = (
        select(
            KBEmbedding.chunk_id,
            KBChunk.document_id,
            KBChunk.chunk_text,
            KBDocument.title,
            (1 - KBEmbedding.embedding.cosine_distance(query_embedding)).label("similarity"),
        )
        .join(KBChunk, KBChunk.id == KBEmbedding.chunk_id)
        .join(KBDocument, KBDocument.id == KBChunk.document_id)
        .where(KBEmbedding.tenant_id == tenant_id)
        .order_by(KBEmbedding.embedding.cosine_distance(query_embedding))
        .limit(k)
    )

    result = await db.execute(stmt)
    rows = result.all()

    return [
        {
            "chunk_id": str(row.chunk_id),
            "document_id": str(row.document_id),
            "title": row.title,
            "chunk_text": row.chunk_text,
            "similarity": float(row.similarity),
        }
        for row in rows
    ]
