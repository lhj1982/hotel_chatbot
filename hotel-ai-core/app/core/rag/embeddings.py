from __future__ import annotations

from openai import AsyncOpenAI

from app.config import settings

_client: AsyncOpenAI | None = None


def _get_client() -> AsyncOpenAI:
    global _client
    if _client is None:
        _client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
    return _client


async def embed_text(text: str) -> list[float]:
    client = _get_client()
    resp = await client.embeddings.create(input=[text], model=settings.OPENAI_EMBEDDING_MODEL)
    return resp.data[0].embedding


async def embed_texts(texts: list[str]) -> list[list[float]]:
    client = _get_client()
    resp = await client.embeddings.create(input=texts, model=settings.OPENAI_EMBEDDING_MODEL)
    return [item.embedding for item in resp.data]
