"""RAG service — semantic search + grounded response generation."""
from __future__ import annotations

from app.ai.embeddings import cosine_similarity, tfidf_cosine


def search_chunks(
    query: str,
    source_chunks: dict[str, list[dict]],
    *,
    top_k: int = 5,
    min_score: float = 0.1,
) -> list[dict]:
    """Search across all source chunks for relevant content.

    Args:
        query: The search query
        source_chunks: {source_id: [{content, index, hash, source_name?}]}
        top_k: Maximum results to return
        min_score: Minimum similarity threshold

    Returns:
        List of {source_id, source_name, chunk_index, content, score} dicts
    """
    # Flatten all chunks with source info
    all_chunks: list[dict] = []
    for source_id, chunks in source_chunks.items():
        for chunk in chunks:
            all_chunks.append({**chunk, "source_id": source_id})

    if not all_chunks:
        return []

    # Extract just the text content for similarity search
    documents = [c["content"] for c in all_chunks]

    # Use TF-IDF similarity (works without API key)
    scores = tfidf_cosine(query, documents)

    # Combine chunks with scores
    scored_chunks = []
    for i, (chunk, score) in enumerate(zip(all_chunks, scores)):
        if score >= min_score:
            scored_chunks.append({
                "source_id": chunk["source_id"],
                "source_name": chunk.get("source_name", "Unknown"),
                "chunk_index": chunk.get("index", i),
                "content": chunk["content"],
                "score": round(score, 4),
            })

    # Sort by score descending, return top_k
    scored_chunks.sort(key=lambda x: x["score"], reverse=True)
    return scored_chunks[:top_k]


def build_source_context(results: list[dict], max_chars: int = 4000) -> str:
    """Build a context string from search results for LLM consumption.

    Formats results as numbered source references that the LLM can cite.
    """
    if not results:
        return ""

    parts = []
    total = 0
    for i, r in enumerate(results, 1):
        chunk_text = r["content"]
        # Truncate if needed
        if total + len(chunk_text) > max_chars:
            remaining = max_chars - total
            if remaining > 200:
                chunk_text = chunk_text[:remaining] + "..."
            else:
                break
        parts.append(f"[SOURCE {i}: {r['source_name']}]\n{chunk_text}")
        total += len(chunk_text)

    return "\n\n".join(parts)


def format_citations(results: list[dict]) -> list[dict]:
    """Format search results as citation objects for the API response."""
    return [
        {
            "source_name": r["source_name"],
            "relevance": round(r["score"] * 100, 1),
            "excerpt": r["content"][:200] + ("..." if len(r["content"]) > 200 else ""),
        }
        for r in results
    ]
