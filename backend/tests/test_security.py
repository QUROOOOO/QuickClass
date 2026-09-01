"""Security: auth boundary, rate limiting, input guards, secret handling."""
import time

from fastapi.testclient import TestClient

from app.main import app
from app.security import hash_secret, safe_text, verify_secret
from app.errors import InvalidInput


def test_passwords_never_stored_plain():
    h = hash_secret("hunter2")
    assert "hunter2" not in h
    assert verify_secret("hunter2", h)
    assert not verify_secret("hunter3", h)
    assert not verify_secret("hunter2", "garbage")


def test_safe_text_guards_length():
    assert safe_text(" ok ", 10, "name") == "ok"
    try:
        safe_text("x" * 100, 10, "name")
        raise AssertionError("should have raised")
    except InvalidInput as exc:
        assert exc.details["length"] == 100


def test_sensitive_fields_not_exposed():
    with TestClient(app) as c:
        app.state.users = []
        r = c.post(
            "/api/v1/auth/signup",
            json={"email": "a@b.co", "password": "secret123", "name": "Ana"},
        )
        body = r.json()
        assert "password_hash" not in body["user"]
        assert "password" not in str(body)


def test_rate_limit_blocks_bursts(monkeypatch):
    from app.api import deps
    from app.security import RateLimiter

    limiter = RateLimiter(per_minute=3)

    class Req:
        client = type("C", (), {"host": "1.2.3.4"})()

    user = {"uid": "x"}
    assert [limiter.allow(Req(), user) for _ in range(3)] == [True, True, True]
    assert limiter.allow(Req(), user) is False
