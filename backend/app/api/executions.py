"""Executions + approvals API."""
from __future__ import annotations

from fastapi import APIRouter, Depends

from app.api.deps import projects as projects_service
from app.errors import ApprovalRequired, ApiError, NotFound
from app.security import current_user, require_auth

router = APIRouter(prefix="/executions", tags=["executions"])


@router.post("/{project_id}/approvals/{approval_id}")
def resolve_approval(project_id: str, approval_id: str, decision: str = "approve", user: dict = Depends(require_auth)):
    svc = projects_service()
    approval = svc.resolve_approval(project_id, approval_id, decision)
    svc.resume_after_approval(project_id)
    return approval.model_dump(mode="json")


@router.get("/{project_id}/approvals")
def list_approvals(project_id: str, user: dict = Depends(current_user)):
    svc = projects_service()
    return [a.model_dump(mode="json") for a in svc.pending_approvals(project_id)]


@router.get("/{project_id}/runs")
def runs(project_id: str, user: dict = Depends(current_user)):
    return [d for d in projects_service().store.list("runs") if d.get("project_id") == project_id]


@router.get("/{project_id}/artifacts")
def artifacts(project_id: str, user: dict = Depends(current_user)):
    return [d for d in projects_service().store.list("artifacts") if d.get("project_id") == project_id]


@router.get("/{project_id}/budget/pause")
def active_budget_pause(project_id: str, user: dict = Depends(current_user)):
    svc = projects_service()
    pause = svc.usage.get_active_pause(project_id)
    return pause.model_dump(mode="json") if pause else None


@router.post("/{project_id}/budget/resume")
def resume_budget(project_id: str, decision: str = "continue", user: dict = Depends(require_auth)):
    svc = projects_service()
    project = svc.resume_after_budget_pause(project_id, decision)
    return project.model_dump(mode="json")


@router.get("/{project_id}/usage")
def usage_summary(project_id: str, user: dict = Depends(current_user)):
    svc = projects_service()
    records = [d for d in svc.store.list("usage_records") if d.get("project_id") == project_id]
    return {"summary": svc.usage.summary(project_id), "records": records}
