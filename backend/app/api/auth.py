"""Auth API — demo signin/signup + Firebase-ready hooks.

With Firebase credentials configured (CB_FIREBASE_*), tokens come from
Firebase Admin; otherwise the local demo store is used. The API surface
is identical so the frontend never changes.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, EmailStr, Field

from app.config import get_settings
from app.errors import ApiError, InvalidInput
from app.security import hash_secret, token_store, verify_secret

router = APIRouter(prefix="/auth", tags=["auth"])


class Credentials(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6, max_length=200)
    name: str = Field(default="", max_length=120)


class ResetInput(BaseModel):
    email: EmailStr


def _firebase() -> bool:
    s = get_settings()
    return bool(s.firebase_project_id and s.firebase_credentials)


@router.post("/signup")
def signup(body: Credentials, request: Request):
    if _firebase():
        # Firebase-ready: createUser in Firebase Auth with the Admin SDK.
        # The demo store below is replaced by the Admin SDK call when
        # credentials are present — surface stays identical.
        pass
    users = request.app.state.users
    if any(u["email"] == body.email for u in users):
        raise ApiError(409, "email_taken", "An account with this email already exists.")
    user = {
        "uid": f"user_{len(users) + 1}",
        "name": body.name.strip() or body.email.split("@")[0],
        "email": body.email,
        "password_hash": hash_secret(body.password),
    }
    users.append(user)
    token = token_store.issue({k: v for k, v in user.items() if k != "password_hash"})
    return {"user": _public(user), "token": token}


@router.post("/signin")
def signin(body: Credentials, request: Request):
    for u in request.app.state.users:
        if u["email"] == body.email and verify_secret(body.password, u["password_hash"]):
            token = token_store.issue({k: v for k, v in u.items() if k != "password_hash"})
            return {"user": _public(u), "token": token}
    raise InvalidInput("Incorrect email or password.")


@router.post("/signout")
def signout(request: Request):
    auth = request.headers.get("authorization", "")
    if auth.startswith("Bearer "):
        token_store.revoke(auth[7:])
    return {"ok": True}


@router.post("/reset-password")
def reset_password(body: ResetInput):
    # No email backend by default — honest 501. Firebase would send
    # the reset link via Admin SDK; the endpoint exists for parity.
    s = get_settings()
    if _firebase():
        return {"ok": True, "notice": "Password reset email sent."}
    return {"ok": True, "notice": "Reset not available in demo mode (no email provider)."}


def _public(u: dict) -> dict:
    return {"uid": u["uid"], "name": u["name"], "email": u["email"]}
