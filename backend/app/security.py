"""Security: auth boundaries, tokens, rate limiting, input guards."""
from __future__ import annotations

import hashlib
import hmac
import secrets
import threading
import time
import uuid
from typing import Callable

from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.config import get_settings
from app.errors import ApiError, Forbidden, InvalidInput

_bearer = HTTPBearer(auto_error=False)


class DemoTokenStore:
    """Sessions for the demo auth — a real provider (Firebase) replaces this."""

    def __init__(self) -> None:
        self._tokens: dict[str, dict] = {}
        self._lock = threading.Lock()

    def issue(self, user: dict) -> str:
        token = secrets.token_urlsafe(32)
        with self._lock:
            self._tokens[token] = {"user": user, "expires": time.time() + 60 * 60 * 24 * 14}
        return token

    def verify(self, token: str) -> dict | None:
        with self._lock:
            rec = self._tokens.get(token)
            if rec is None:
                return None
            if rec["expires"] < time.time():
                self._tokens.pop(token, None)
                return None
            return rec["user"]

    def revoke(self, token: str) -> None:
        with self._lock:
            self._tokens.pop(token, None)


token_store = DemoTokenStore()


def current_user(cred: HTTPAuthorizationCredentials | None = Depends(_bearer)) -> dict:
    """Bearer-token boundary. Requests without a valid token are guests."""
    if cred is None:
        return {"uid": "guest", "name": "Guest", "email": ""}
    user = token_store.verify(cred.credentials)
    if user is None:
        raise Forbidden("Session expired or invalid.")
    return user


def require_auth(user: dict = Depends(current_user)) -> dict:
    if user["uid"] == "guest":
        raise Forbidden("Sign in to access this resource.")
    return user


class RateLimiter:
    """Fixed-window rate limiting keyed by client identity."""

    def __init__(self, per_minute: int) -> None:
        self.per_minute = per_minute
        self._hits: dict[str, list[float]] = {}
        self._lock = threading.Lock()

    def _key(self, request: Request, user: dict) -> str:
        ident = user.get("uid") or request.client.host if request.client else "unknown"
        return ident

    def allow(self, request: Request, user: dict) -> bool:
        key = self._key(request, user)
        now = time.time()
        with self._lock:
            window = self._hits.setdefault(key, [])
            window[:] = [t for t in window if t > now - 60]
            if len(window) >= self.per_minute:
                return False
            window.append(now)
            return True


def rate_limit(user: dict = Depends(current_user)):
    """Dependency — enforce the configured per-minute budget."""
    settings = get_settings()
    limiter = RateLimiter(settings.rate_limit_per_minute)
    import app.api.deps as deps

    def dep(request: Request) -> None:
        if not limiter.allow(request, user):
            raise ApiError(429, "rate_limited", "Too many requests. Slow down and retry.")

    return Depends(dep)


def hash_secret(value: str) -> str:
    """Never store passwords. Never store even their hash without pepper/salt."""
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", value.encode(), salt.encode(), 120_000)
    return f"pbkdf2${salt}${digest.hex()}"


def verify_secret(value: str, stored: str) -> bool:
    try:
        algo, salt, hexdigest = stored.split("$")
        if algo != "pbkdf2":
            return False
        digest = hashlib.pbkdf2_hmac("sha256", value.encode(), salt.encode(), 120_000)
        return hmac.compare_digest(digest.hex(), hexdigest)
    except (ValueError, TypeError):
        return False


def safe_text(value: str, max_len: int, field: str) -> str:
    value = (value or "").strip()
    if len(value) > max_len:
        raise InvalidInput(f"{field} is too long (max {max_len}).", field=field, length=len(value))
    return value
