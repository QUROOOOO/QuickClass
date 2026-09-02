"""Source ingestion pipeline — file → text → chunks → embeddings → store."""
from __future__ import annotations

import hashlib
import io
import os
import re

from pypdf import PdfReader


def extract_text(filename: str, content: bytes) -> str:
    """Extract text from a file based on its extension."""
    ext = os.path.splitext(filename or "")[1].lower()

    if ext == ".pdf":
        return _extract_pdf(content)
    if ext in (".txt", ".md", ".markdown"):
        return _decode_text(content)
    if ext in (".docx", ".doc"):
        return _extract_docx(content)
    if ext in (".png", ".jpg", ".jpeg", ".gif", ".webp"):
        return f"[Image file: {filename} — OCR not yet available]"
    if ext in (".mp3", ".mp4", ".wav"):
        return f"[Audio file: {filename} — transcription not yet available]"

    # Try reading as text
    return _decode_text(content)


def _extract_pdf(content: bytes) -> str:
    """Extract text from PDF using pypdf."""
    try:
        reader = PdfReader(io.BytesIO(content))
        pages = []
        for i, page in enumerate(reader.pages):
            text = page.extract_text()
            if text and text.strip():
                pages.append(f"--- Page {i + 1} ---\n{text.strip()}")
        return "\n\n".join(pages)
    except Exception as e:
        return f"[Error reading PDF: {e}]"


def _decode_text(content: bytes) -> str:
    """Decode bytes as text with encoding fallback."""
    for encoding in ("utf-8", "latin-1", "ascii"):
        try:
            return content.decode(encoding)
        except (UnicodeDecodeError, ValueError):
            continue
    return content.decode("utf-8", errors="replace")


def _extract_docx(content: bytes) -> str:
    """Extract text from DOCX using python-docx if available, else fallback."""
    try:
        from docx import Document

        doc = Document(io.BytesIO(content))
        return "\n\n".join(p.text for p in doc.paragraphs if p.text.strip())
    except ImportError:
        return "[DOCX support requires python-docx — install with: pip install python-docx]"
    except Exception as e:
        return f"[Error reading DOCX: {e}]"


def chunk_text(text: str, chunk_size: int = 1000, overlap: int = 200) -> list[dict]:
    """Split text into overlapping chunks with metadata.

    Returns list of dicts with 'content', 'index', and 'hash' keys.
    Tries to break at paragraph > sentence > word boundaries.
    """
    if not text or not text.strip():
        return []

    # Normalize whitespace but preserve paragraph breaks
    text = re.sub(r"\n{3,}", "\n\n", text.strip())

    chunks: list[dict] = []
    start = 0
    idx = 0

    while start < len(text):
        end = min(start + chunk_size, len(text))

        if end < len(text):
            # Try to break at paragraph boundary
            para_break = text.rfind("\n\n", start + chunk_size // 2, end)
            if para_break > start:
                end = para_break + 2
            else:
                # Try sentence boundary
                for sep in (". ", ".\n", "! ", "? ", ";\n", "\n"):
                    sent_break = text.rfind(sep, start + chunk_size // 3, end)
                    if sent_break > start:
                        end = sent_break + len(sep)
                        break

        chunk_content = text[start:end].strip()
        if chunk_content:
            content_hash = hashlib.md5(chunk_content.encode()).hexdigest()[:12]
            chunks.append({"content": chunk_content, "index": idx, "hash": content_hash})
            idx += 1

        # Move start forward, accounting for overlap
        start = end - overlap
        if start >= end:
            break

    return chunks


def get_source_stats(chunks: list[dict]) -> dict:
    """Get statistics about a set of chunks."""
    if not chunks:
        return {"chunk_count": 0, "total_chars": 0, "total_words": 0}

    total_chars = sum(len(c["content"]) for c in chunks)
    total_words = sum(len(c["content"].split()) for c in chunks)

    return {
        "chunk_count": len(chunks),
        "total_chars": total_chars,
        "total_words": total_words,
        "estimated_pages": max(1, total_chars // 3000),
    }
