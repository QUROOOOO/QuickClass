"""Projects API."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.api.deps import projects as projects_service
from app.errors import ApiError, NotFound
from app.security import current_user, rate_limit, require_auth

router = APIRouter(prefix="/projects", tags=["projects"])


class CreateProject(BaseModel):
    title: str = Field(min_length=1, max_length=200)


class StartPlanning(BaseModel):
    goal: str = Field(min_length=4, max_length=4000)
    context: str = Field(default="", max_length=8000)


@router.post("")
def create_project(body: CreateProject, user: dict = Depends(require_auth)):
    return projects_service().create_project(owner_id=user["uid"], title=body.title).model_dump(mode="json")


@router.get("")
def list_projects(user: dict = Depends(require_auth)):
    return [p.model_dump(mode="json") for p in projects_service().list_projects(user["uid"])]


@router.get("/{project_id}")
def get_project(project_id: str, user: dict = Depends(current_user)):
    project = projects_service().get_project(project_id)
    if user["uid"] != "guest" and project.owner_id != user["uid"]:
        raise ApiError(403, "forbidden", "You don't have access to this project.")
    return project.model_dump(mode="json")


@router.post("/{project_id}/planning")
def start_planning(project_id: str, body: StartPlanning, user: dict = Depends(require_auth)):
    return projects_service().start_planning(project_id, body.goal, body.context).model_dump(mode="json")


@router.post("/{project_id}/submit")
def submit(project_id: str, user: dict = Depends(require_auth)):
    return projects_service().submit_plan_for_review(project_id).model_dump(mode="json")


@router.post("/{project_id}/review")
def review(project_id: str, decision: str = "approve", reason: str = "", user: dict = Depends(require_auth)):
    return projects_service().resolve_plan_review(project_id, decision, reason).model_dump(mode="json")


@router.post("/{project_id}/execute")
def execute(project_id: str, user: dict = Depends(require_auth)):
    return projects_service().execute(project_id).model_dump(mode="json")


@router.post("/{project_id}/complete")
def complete(project_id: str, user: dict = Depends(require_auth)):
    return projects_service().complete_project(project_id).model_dump(mode="json")
