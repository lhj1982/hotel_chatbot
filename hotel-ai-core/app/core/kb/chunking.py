from __future__ import annotations

import hashlib


def chunk_text(text: str, chunk_size: int = 800, overlap: int = 200) -> list[dict]:
    """Split text into overlapping chunks and return list of {chunk_text, chunk_hash}."""
    chunks: list[dict] = []
    start = 0
    while start < len(text):
        end = start + chunk_size
        segment = text[start:end]
        chunk_hash = hashlib.sha256(segment.encode()).hexdigest()
        chunks.append({"chunk_text": segment, "chunk_hash": chunk_hash})
        start += chunk_size - overlap
    return chunks
