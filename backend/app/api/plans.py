"""Plans API — versioned plans, tech decisions, invalidation."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.api.deps import plans as plans_service
from app.api.deps import projects as projects_service
from app.domain.models import PlanInput, TechEditInput
from app.security import current_user, require_auth

router = APIRouter(prefix="/plans", tags=["plans"])


class PlanCreate(PlanInput):
    project_id: str = Field(min_length=4, max_length=60)


@router.post("")
def create_plan(body: PlanCreate, user: dict = Depends(require_auth)):
    """Goal → plan v1 (structured planning flow builds on this)."""
    return plans_service().create_plan(
        project_id=body.project_id,
        goal=body.goal,
        context=body.context,
    ).to_dict()


@router.get("/{project_id}")
def get_latest(project_id: str, user: dict = Depends(current_user)):
    plan = plans_service().store(project_id).latest()
    return plan.to_dict() if plan else {"version": 0, "tasks": [], "technology": []}


@router.get("/{project_id}/history")
def history(project_id: str, user: dict = Depends(current_user)):
    return plans_service().history(project_id)


@router.post("/{project_id}/tech")
def edit_tech(project_id: str, body: TechEditInput, user: dict = Depends(require_auth)):
    """Edit a tech decision → new version + cascade invalidation."""
    version = plans_service().edit_tech_decision(
        project_id, category=body.category, choice=body.choice, reason=body.reason
    )
    return {
        "version": version.version,
        "reason": version.reason,
        "parent_version": version.parent_version,
        "technology": [t.model_dump(mode="json") for t in version.technology],
        "invalidated_task_ids": [
            t.id for t in version.tasks if any(d.startswith("tech_") for d in t.depends_on)
        ],
    }


@router.get("/{project_id}/ready")
def ready_tasks(project_id: str, user: dict = Depends(current_user)):
    return {"ready": plans_service().graph_ready(project_id)}
