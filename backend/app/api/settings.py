"""Settings API — provider credentials and budget configuration.

Credential responses are always masked; the raw key is never returned,
logged, or embedded in any response body. See app/services/credentials.py
for the documented limitations of the local storage implementation.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.api.deps import credentials as credentials_service
from app.api.deps import projects as projects_service
from app.domain.usage import BudgetConfig, BudgetMode, BudgetPeriod, Provider
from app.security import current_user, require_auth

router = APIRouter(prefix="/settings", tags=["settings"])


class SaveKeyBody(BaseModel):
    provider: Provider
    api_key: str
    label: str = ""


@router.post("/api-keys")
def save_key(body: SaveKeyBody, user: dict = Depends(require_auth)):
    cred = credentials_service().save(body.provider, body.api_key, body.label)
    return cred.model_dump(mode="json")


@router.get("/api-keys")
def list_keys(user: dict = Depends(current_user)):
    return [c.model_dump(mode="json") for c in credentials_service().list()]


@router.post("/api-keys/{cred_id}/test")
def test_key(cred_id: str, user: dict = Depends(require_auth)):
    cred = credentials_service().test_connection(cred_id)
    return cred.model_dump(mode="json")


@router.delete("/api-keys/{cred_id}")
def remove_key(cred_id: str, user: dict = Depends(require_auth)):
    ok = credentials_service().remove(cred_id)
    return {"removed": ok}


class BudgetBody(BaseModel):
    mode: BudgetMode = BudgetMode.DISABLED
    limit_tokens: int | None = None
    limit_cost: float | None = None
    period: BudgetPeriod = BudgetPeriod.PER_PROJECT


@router.get("/budget/{project_id}")
def get_budget(project_id: str, user: dict = Depends(current_user)):
    return projects_service().usage.get_budget(project_id).model_dump(mode="json")


@router.put("/budget/{project_id}")
def set_budget(project_id: str, body: BudgetBody, user: dict = Depends(require_auth)):
    cfg = BudgetConfig(project_id=project_id, **body.model_dump())
    return projects_service().usage.set_budget(cfg).model_dump(mode="json")
