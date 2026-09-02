"""In-memory persistence with JSON file fallback — no native deps required."""
from __future__ import annotations
import json
import time
import uuid
from pathlib import Path

DATA_DIR = Path(__file__).parent.parent.parent / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)
STORE_FILE = DATA_DIR / "quickclass.json"

_classes: dict[str, dict] = {}
_sources: dict[str, dict] = {}  # source_id -> source dict
_source_chunks: dict[str, list[dict]] = {}  # class_id -> [{content, source_name, source_id, chunk_index}]
_learner_profiles: dict[str, dict] = {}  # "class_id:user_id" -> profile dict
_chat_history: dict[str, list[dict]] = {}  # class_id -> [{role, content, sources, created_at}]


def _save():
    data = {
        "classes": _classes,
        "sources": _sources,
        "source_chunks": _source_chunks,
        "learner_profiles": _learner_profiles,
        "chat_history": _chat_history,
    }
    STORE_FILE.write_text(json.dumps(data, default=str))


def _load():
    global _classes, _sources, _source_chunks, _learner_profiles, _chat_history
    if STORE_FILE.exists():
        try:
            data = json.loads(STORE_FILE.read_text())
            _classes = data.get("classes", {})
            _sources = data.get("sources", {})
            _source_chunks = data.get("source_chunks", {})
            _learner_profiles = data.get("learner_profiles", {})
            _chat_history = data.get("chat_history", {})
        except Exception:
            pass


_load()


# ── Classes ──

def create_class(name: str, emoji: str = "📚", description: str = "") -> dict:
    now = time.time()
    class_id = str(uuid.uuid4())[:8]
    _classes[class_id] = {
        "id": class_id, "name": name, "emoji": emoji, "description": description,
        "created_at": now, "updated_at": now,
    }
    _save()
    return {**_classes[class_id], "source_count": 0}


def list_classes() -> list[dict]:
    result = []
    for cid, cls in sorted(_classes.items(), key=lambda x: x[1].get("updated_at", 0), reverse=True):
        sc = sum(1 for s in _sources.values() if s.get("class_id") == cid)
        result.append({**cls, "source_count": sc})
    return result


def get_class(class_id: str) -> dict | None:
    cls = _classes.get(class_id)
    if not cls:
        return None
    sc = sum(1 for s in _sources.values() if s.get("class_id") == class_id)
    return {**cls, "source_count": sc}


def delete_class(class_id: str) -> bool:
    _classes.pop(class_id, None)
    to_delete = [sid for sid, s in _sources.items() if s.get("class_id") == class_id]
    for sid in to_delete:
        _sources.pop(sid, None)
    _source_chunks.pop(class_id, None)
    _chat_history.pop(class_id, None)
    _save()
    return True


# ── Sources ──

def create_source(class_id: str, name: str, source_type: str = "document",
                  size: int = 0, status: str = "processing",
                  chunk_count: int = 0, word_count: int = 0) -> dict:
    now = time.time()
    source_id = str(uuid.uuid4())[:8]
    _sources[source_id] = {
        "id": source_id, "class_id": class_id, "name": name, "type": source_type,
        "size": size, "status": status, "chunk_count": chunk_count,
        "word_count": word_count, "created_at": now,
    }
    _save()
    return _sources[source_id]


def list_sources(class_id: str) -> list[dict]:
    return sorted(
        [s for s in _sources.values() if s.get("class_id") == class_id],
        key=lambda x: x.get("created_at", 0), reverse=True,
    )


def get_source(source_id: str) -> dict | None:
    return _sources.get(source_id)


def update_source_status(source_id: str, status: str, chunk_count: int = 0, word_count: int = 0):
    if source_id in _sources:
        _sources[source_id]["status"] = status
        _sources[source_id]["chunk_count"] = chunk_count
        _sources[source_id]["word_count"] = word_count
        _save()


def delete_source(source_id: str) -> bool:
    source = _sources.pop(source_id, None)
    if source:
        class_id = source["class_id"]
        chunks = _source_chunks.get(class_id, [])
        _source_chunks[class_id] = [c for c in chunks if c.get("source_id") != source_id]
        _save()
    return True


# ── Source Chunks ──

def store_chunks(source_id: str, chunks: list[str]):
    source = _sources.get(source_id)
    if not source:
        return
    class_id = source["class_id"]
    if class_id not in _source_chunks:
        _source_chunks[class_id] = []
    for i, chunk in enumerate(chunks):
        _source_chunks[class_id].append({
            "content": chunk,
            "chunk_index": i,
            "source_name": source["name"],
            "source_id": source_id,
        })
    _save()


def get_chunks(class_id: str) -> list[dict]:
    return _source_chunks.get(class_id, [])


# ── Learner Profiles ──

def save_learner_profile(class_id: str, user_id: str, data: dict):
    _learner_profiles[f"{class_id}:{user_id}"] = data
    _save()


def load_learner_profile(class_id: str, user_id: str = "default") -> dict | None:
    return _learner_profiles.get(f"{class_id}:{user_id}")


# ── Chat History ──

def save_chat(class_id: str, role: str, content: str, sources: list | None = None):
    if class_id not in _chat_history:
        _chat_history[class_id] = []
    _chat_history[class_id].append({
        "role": role, "content": content,
        "sources": sources or [], "created_at": time.time(),
    })
    _save()


def get_chat_history(class_id: str, limit: int = 20) -> list[dict]:
    history = _chat_history.get(class_id, [])
    return history[-limit:]
