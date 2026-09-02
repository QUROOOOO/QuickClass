"""Embedding service — OpenAI embeddings with fallback to TF-IDF cosine similarity."""
from __future__ import annotations

import math
import os
import re
from collections import Counter

import httpx


# ── Vector math helpers ───────────────────────────────────────


def cosine_similarity(a: list[float], b: list[float]) -> float:
    """Compute cosine similarity between two vectors."""
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(x * x for x in b))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


# ── TF-IDF fallback ──────────────────────────────────────────


def _tokenize(text: str) -> list[str]:
    """Simple tokenization for TF-IDF fallback."""
    return re.findall(r"\b[a-z]{2,}\b", text.lower())


IDF_CACHE: dict[str, float] = {}


def tfidf_vectorize(text: str, idf: dict[str, float] | None = None) -> list[float]:
    """Convert text to a sparse TF-IDF vector (fixed 512-dim hash space)."""
    tokens = _tokenize(text)
    tf = Counter(tokens)
    total = len(tokens) or 1

    vec = [0.0] * 512
    for token, count in tf.items():
        weight = (count / total) * idf.get(token, 1.0) if idf else count / total
        idx = hash(token) % 512
        vec[idx] += weight
    return vec


def tfidf_cosine(query: str, documents: list[str]) -> list[float]:
    """Compute cosine similarity between query and each document using TF-IDF."""
    all_texts = [query] + documents
    all_tokens = [_tokenize(t) for t in all_texts]

    # Compute IDF
    doc_count = len(all_texts)
    idf: dict[str, float] = {}
    all_unique = set()
    for tokens in all_tokens:
        unique = set(tokens)
        all_unique |= unique
    for token in all_unique:
        containing = sum(1 for tokens in all_tokens if token in tokens)
        idf[token] = math.log(doc_count / (1 + containing)) + 1

    query_vec = tfidf_vectorize(query, idf)
    doc_vecs = [tfidf_vectorize(doc, idf) for doc in documents]

    return [cosine_similarity(query_vec, dv) for dv in doc_vecs]


# ── OpenAI embeddings ─────────────────────────────────────────


async def openai_embed(texts: list[str]) -> list[list[float]]:
    """Get embeddings from OpenAI API. Returns list of vectors."""
    api_key = os.getenv("OPENAI_API_KEY", "")
    base_url = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1")
    model = os.getenv("OPENAI_EMBEDDING_MODEL", "text-embedding-3-small")

    if not api_key:
        return [tfidf_vectorize(t) for t in texts]

    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
    payload = {"model": model, "input": texts}

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(f"{base_url}/embeddings", headers=headers, json=payload)
        resp.raise_for_status()
        data = resp.json()
        return [item["embedding"] for item in data["data"]]


async def embed_query(text: str) -> list[float]:
    """Embed a single query string."""
    vectors = await openai_embed([text])
    return vectors[0]


async def embed_documents(texts: list[str]) -> list[list[float]]:
    """Embed multiple document chunks."""
    # Batch in groups of 20 to stay within API limits
    all_vectors: list[list[float]] = []
    for i in range(0, len(texts), 20):
        batch = texts[i : i + 20]
        vectors = await openai_embed(batch)
        all_vectors.extend(vectors)
    return all_vectors
