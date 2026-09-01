"""Domain models — the entities of the system, Pydantic-typed end to end."""
from __future__ import annotations

import time
import uuid
from datetime import date
from enum import StrEnum
from typing import Literal

from pydantic import BaseModel, Field, field_validator


def _id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:12]}"


def _now() -> float:
    return time.time()


# ---------------------------------------------------------------------------
# enums
# ---------------------------------------------------------------------------

class ProjectStatus(StrEnum):
    DRAFT = "draft"
    PLANNING = "planning"
    AWAITING_REVIEW = "awaiting_review"
    APPROVED = "approved"
    EXECUTING = "executing"
    TESTING = "testing"
    REVIEWING = "reviewing"
    REPAIRING = "repairing"
    VERIFIED = "verified"
    COMPLETED = "completed"
    BLOCKED = "blocked"
    BUDGET_PAUSED = "budget_paused"
    FAILED = "failed"


class DecisionStatus(StrEnum):
    PROPOSED = "proposed"
    RECOMMENDED = "recommended"
    SELECTED = "selected"
    REJECTED = "rejected"
    SUPERSEDED = "superseded"


class TaskStatus(StrEnum):
    PENDING = "pending"
    READY = "ready"
    RUNNING = "running"
    BLOCKED = "blocked"
    DONE = "done"
    FAILED = "failed"
    SKIPPED = "skipped"


class AgentRole(StrEnum):
    MASTER = "master"
    PLANNER = "planner"
    EXECUTOR = "executor"


class ToolRisk(StrEnum):
    READ = "read"
    WRITE = "write"
    DESTRUCTIVE = "destructive"
    EXTERNAL = "external"


class ToolPermission(StrEnum):
    ALLOW = "allow"
    ASK = "ask"
    DENY = "deny"


class FindingSeverity(StrEnum):
    INFO = "info"
    WARNING = "warning"
    CRITICAL = "critical"


# ---------------------------------------------------------------------------
# entities
# ---------------------------------------------------------------------------

class Project(BaseModel):
    id: str = Field(default_factory=lambda: _id("proj"))
    owner_id: str = "local"
    title: str
    status: ProjectStatus = ProjectStatus.DRAFT
    goal_id: str | None = None
    current_plan_version: int = 0
    created_at: float = Field(default_factory=_now)
    updated_at: float = Field(default_factory=_now)


class Goal(BaseModel):
    id: str = Field(default_factory=lambda: _id("goal"))
    project_id: str
    statement: str
    context: str = ""
    updated_at: float = Field(default_factory=_now)


class Requirement(BaseModel):
    id: str = Field(default_factory=lambda: _id("req"))
    project_id: str
    statement: str
    verified: bool = False
    evidence: list[str] = Field(default_factory=list)


class ArchitectureDecision(BaseModel):
    id: str = Field(default_factory=lambda: _id("adr"))
    project_id: str
    title: str
    status: DecisionStatus = DecisionStatus.PROPOSED
    rationale: str = ""
    alternatives: list[str] = Field(default_factory=list)
    superseded_by: str | None = None


class TechDecision(BaseModel):
    id: str = Field(default_factory=lambda: _id("tech"))
    project_id: str
    category: str  # FRONTEND | DATABASE | PAYMENTS | ...
    choice: str
    status: DecisionStatus = DecisionStatus.SELECTED
    reason: str = ""
    superseded_by: str | None = None


class Milestone(BaseModel):
    id: str = Field(default_factory=lambda: _id("ms"))
    project_id: str
    title: str
    description: str = ""
    order: int = 0
    completed: bool = False
    completion_evidence: list[str] = Field(default_factory=list)


class Task(BaseModel):
    id: str = Field(default_factory=lambda: _id("task"))
    project_id: str
    title: str
    description: str = ""
    status: TaskStatus = TaskStatus.PENDING
    milestone_id: str | None = None
    depends_on: list[str] = Field(default_factory=list)
    agent: AgentRole = AgentRole.EXECUTOR
    evidence: list[str] = Field(default_factory=list)


class Dependency(BaseModel):
    id: str = Field(default_factory=lambda: _id("dep"))
    project_id: str
    task_id: str
    depends_on_task: str


class Execution(BaseModel):
    id: str = Field(default_factory=lambda: _id("exe"))
    project_id: str
    plan_version: int
    started_at: float = Field(default_factory=_now)
    finished_at: float | None = None
    status: Literal["running", "succeeded", "failed", "aborted"] = "running"


class AgentRun(BaseModel):
    id: str = Field(default_factory=lambda: _id("run"))
    project_id: str
    execution_id: str
    role: AgentRole
    task_id: str | None = None
    status: Literal["running", "succeeded", "failed", "needs_approval"] = "running"
    started_at: float = Field(default_factory=_now)
    finished_at: float | None = None
    summary: str = ""
    error: str = ""


class ToolCall(BaseModel):
    id: str = Field(default_factory=lambda: _id("tc"))
    project_id: str
    run_id: str
    tool: str
    args: dict = Field(default_factory=dict)
    risk: ToolRisk = ToolRisk.READ
    permission: ToolPermission = ToolPermission.ALLOW
    retries: int = 0
    status: Literal["pending", "approved", "denied", "succeeded", "failed"] = "pending"
    result: str = ""


class Artifact(BaseModel):
    id: str = Field(default_factory=lambda: _id("art"))
    project_id: str
    run_id: str | None = None
    name: str
    kind: str = "file"
    content_type: str = "text/plain"
    summary: str = ""


class Review(BaseModel):
    id: str = Field(default_factory=lambda: _id("rev"))
    project_id: str
    plan_version: int
    created_at: float = Field(default_factory=_now)
    resolved_at: float | None = None
    status: Literal["open", "approved", "rejected"] = "open"
    summary: str = ""


class Finding(BaseModel):
    id: str = Field(default_factory=lambda: _id("find"))
    project_id: str
    review_id: str
    severity: FindingSeverity = FindingSeverity.WARNING
    title: str
    description: str = ""
    repaired: bool = False
    repair_evidence: str = ""


class Approval(BaseModel):
    id: str = Field(default_factory=lambda: _id("appr"))
    project_id: str
    kind: Literal["plan", "tool", "publish"] = "tool"
    subject: str = ""
    requested_at: float = Field(default_factory=_now)
    resolved_at: float | None = None
    status: Literal["pending", "approved", "denied"] = "pending"
    detail: str = ""


class Event(BaseModel):
    """Audit-persisted event (mirror of DomainEvent for storage)."""

    event_id: str
    type: str
    project_id: str | None = None
    occurred_at: float
    payload: dict = Field(default_factory=dict)


# ---------------------------------------------------------------------------
# validators
# ---------------------------------------------------------------------------

class PlanInput(BaseModel):
    goal: str = Field(min_length=4, max_length=4000)
    context: str = Field(default="", max_length=8000)

    @field_validator("goal")
    @classmethod
    def goal_not_blank(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("goal cannot be blank")
        return v


class TechEditInput(BaseModel):
    category: str = Field(min_length=1, max_length=60)
    choice: str = Field(min_length=1, max_length=200)
    reason: str = Field(default="", max_length=2000)

    @field_validator("category", "choice")
    @classmethod
    def not_blank(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("cannot be blank")
        return v
