from __future__ import annotations

import re
import uuid

from openai import AsyncOpenAI
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.guardrails.prompt import build_system_prompt
from app.core.rag.embeddings import embed_text
from app.core.rag.retrieval import search_similar_chunks

# Greeting patterns (English + Swedish)
_GREETING_RE = re.compile(
    r"^\s*(hi|hello|hey|hej|hejsan|hallå|god\s*(morgon|dag|kväll)"
    r"|good\s*(morning|afternoon|evening)|howdy|tjena|tja)\s*[!?.]*\s*$",
    re.IGNORECASE,
)


def _is_greeting(message: str) -> bool:
    return bool(_GREETING_RE.match(message.strip()))


async def rag_answer(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    user_message: str,
    escalation_phone: str | None = None,
    escalation_email: str | None = None,
    greeting_message: str | None = None,
) -> dict:
    """Full RAG pipeline: embed → retrieve → prompt → respond."""
    # 0. Handle greetings without RAG search
    if _is_greeting(user_message):
        default = "Hello! Welcome — I'm your hotel assistant. How can I help you today?"
        return {
            "outcome": "answered",
            "answer_text": greeting_message or default,
            "citations": [],
            "confidence": 1.0,
            "escalation": None,
        }

    # 1. Embed the user query
    query_embedding = await embed_text(user_message)

    # 2. Retrieve relevant chunks
    chunks = await search_similar_chunks(db, tenant_id, query_embedding)

    # 3. Check confidence
    max_similarity = max((c["similarity"] for c in chunks), default=0.0)
    print(f"Max similarity: {max_similarity}")
    print(f"Chunks retrieved: {len(chunks)}")
    print(settings.RAG_CONFIDENCE_THRESHOLD)
    if max_similarity < settings.RAG_CONFIDENCE_THRESHOLD or not chunks:
        return {
            "outcome": "fallback",
            "answer_text": None,
            "citations": [],
            "confidence": max_similarity,
            "escalation": {
                "phone": escalation_phone,
                "email": escalation_email,
                "message": "I couldn't find relevant information. Please contact our team directly.",
            },
        }

    # 4. Build context and prompt
    context_parts = []
    citations = []
    for c in chunks:
        context_parts.append(f"[Source: {c['title']}]\n{c['chunk_text']}")
        citations.append({
            "document_id": c["document_id"],
            "title": c["title"],
            "chunk_id": c["chunk_id"],
        })

    context_text = "\n\n---\n\n".join(context_parts)
    system_prompt = build_system_prompt(
        context_text, escalation_phone=escalation_phone, escalation_email=escalation_email
    )

    # 5. Call LLM
    client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
    chat_resp = await client.chat.completions.create(
        model=settings.OPENAI_CHAT_MODEL,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message},
        ],
        temperature=0.2,
        max_tokens=1024,
    )

    answer_text = chat_resp.choices[0].message.content

    return {
        "outcome": "answered",
        "answer_text": answer_text,
        "citations": citations,
        "confidence": max_similarity,
        "escalation": None,
    }
