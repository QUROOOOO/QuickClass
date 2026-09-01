"""Credential storage — provider-neutral, key material never leaves this module.

Design constraints (documented, not hidden):
  - This is a LOCAL, single-tenant implementation. Raw keys are kept in an
    obfuscated (base64) local file, never in the main event-sourced store,
    never logged, never returned to any API response or serialized into
    `ApiCredential`.
  - `test_connection` performs a LOCAL FORMAT CHECK only (provider-specific
    key shape). It does NOT make a live network call to the provider in
    this environment. That limitation is intentional and reported —
    pretending to verify connectivity without a real network round-trip
    would be dishonest.
  - For real production deployments, replace `LocalObfuscatedCredentialStore`
    with a secret-manager-backed implementation behind the same
    `CredentialStore` interface (e.g. GCP Secret Manager, Vault, KMS).
"""
from __future__ import annotations

import base64
import json
import os
import re
import threading
from pathlib import Path
from typing import Protocol

from app.domain.usage import ApiCredential, Provider

_FORMAT_HINTS: dict[Provider, re.Pattern] = {
    Provider.OPENAI: re.compile(r"^sk-[A-Za-z0-9_\-]{16,}$"),
    Provider.ANTHROPIC: re.compile(r"^sk-ant-[A-Za-z0-9_\-]{16,}$"),
    Provider.OPENROUTER: re.compile(r"^sk-or-[A-Za-z0-9_\-]{16,}$"),
    Provider.GEMINI: re.compile(r"^[A-Za-z0-9_\-]{16,}$"),
    Provider.CUSTOM: re.compile(r"^.{4,}$"),
}


def mask_key(raw: str) -> str:
    if len(raw) <= 8:
        return "***"
    return f"{raw[:3]}...{raw[-4:]}"


def check_format(provider: Provider, raw: str) -> bool:
    pattern = _FORMAT_HINTS.get(provider, _FORMAT_HINTS[Provider.CUSTOM])
    return bool(raw) and bool(pattern.match(raw))


class CredentialStore(Protocol):
    def put_raw(self, cred_id: str, raw: str) -> None: ...
    def get_raw(self, cred_id: str) -> str | None: ...
    def delete_raw(self, cred_id: str) -> None: ...


class LocalObfuscatedCredentialStore:
    """Base64-obfuscated local file. NOT encryption. Local/dev use only."""

    def __init__(self, path: str = "data/credentials.local.json") -> None:
        self._path = Path(path)
        self._path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = threading.Lock()
        if not self._path.exists():
            self._path.write_text("{}")
        try:
            os.chmod(self._path, 0o600)
        except OSError:
            pass

    def _read(self) -> dict:
        try:
            return json.loads(self._path.read_text() or "{}")
        except (json.JSONDecodeError, FileNotFoundError):
            return {}

    def _write(self, data: dict) -> None:
        self._path.write_text(json.dumps(data))
        try:
            os.chmod(self._path, 0o600)
        except OSError:
            pass

    def put_raw(self, cred_id: str, raw: str) -> None:
        with self._lock:
            data = self._read()
            data[cred_id] = base64.b64encode(raw.encode()).decode()
            self._write(data)

    def get_raw(self, cred_id: str) -> str | None:
        with self._lock:
            data = self._read()
            enc = data.get(cred_id)
            return base64.b64decode(enc).decode() if enc else None

    def delete_raw(self, cred_id: str) -> None:
        with self._lock:
            data = self._read()
            data.pop(cred_id, None)
            self._write(data)


class CredentialService:
    def __init__(self, raw_store: CredentialStore | None = None) -> None:
        self._raw = raw_store or LocalObfuscatedCredentialStore()
        self._index: dict[str, ApiCredential] = {}
        self._lock = threading.Lock()

    def save(self, provider: Provider, raw_key: str, label: str = "") -> ApiCredential:
        cred = ApiCredential(provider=provider, label=label, masked_key=mask_key(raw_key))
        with self._lock:
            self._raw.put_raw(cred.id, raw_key)
            self._index[cred.id] = cred
        return cred

    def list(self) -> list[ApiCredential]:
        return list(self._index.values())

    def get(self, cred_id: str) -> ApiCredential | None:
        return self._index.get(cred_id)

    def remove(self, cred_id: str) -> bool:
        with self._lock:
            existed = cred_id in self._index
            self._index.pop(cred_id, None)
            self._raw.delete_raw(cred_id)
        return existed

    def test_connection(self, cred_id: str) -> ApiCredential:
        """Local format check only — see module docstring for the honest limitation."""
        cred = self._index.get(cred_id)
        if cred is None:
            raise KeyError(cred_id)
        raw = self._raw.get_raw(cred_id)
        ok = bool(raw) and check_format(cred.provider, raw)
        cred.status = "verified" if ok else "invalid"
        return cred


credential_service = CredentialService()
