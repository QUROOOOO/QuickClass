"""Usage, budget, and credential domain models.

Kept separate from models.py to isolate the new subsystem. Same
patterns as the rest of the domain: plain Pydantic models with an
`id` factory, persisted through the existing Store abstraction.
"""
from __future__ import annotations

from enum import StrEnum

from pydantic import BaseModel, Field

from app.domain.models import _id, _now


class Provider(StrEnum):
    GEMINI = "gemini"
    OPENAI = "openai"
    ANTHROPIC = "anthropic"
    OPENROUTER = "openrouter"
    CUSTOM = "custom"


class BudgetMode(StrEnum):
    DISABLED = "disabled"
    TOKENS = "tokens"
    COST = "cost"


class BudgetPeriod(StrEnum):
    PER_RUN = "per_run"
    PER_PROJECT = "per_project"
    DAILY = "daily"
    MONTHLY = "monthly"


class UsageStatus(StrEnum):
    OK = "ok"
    RESERVED = "reserved"
    FAILED = "failed"


class ApiCredential(BaseModel):
    """What is ever returned to the client — the raw key never is."""

    id: str = Field(default_factory=lambda: _id("cred"))
    provider: Provider
    label: str = ""
    masked_key: str  # e.g. "sk-...ab12"
    status: str = "unverified"  # unverified | verified | invalid
    created_at: float = Field(default_factory=_now)


class BudgetConfig(BaseModel):
    project_id: str
    mode: BudgetMode = BudgetMode.DISABLED
    limit_tokens: int | None = None
    limit_cost: float | None = None
    period: BudgetPeriod = BudgetPeriod.PER_PROJECT
    updated_at: float = Field(default_factory=_now)


class UsageRecord(BaseModel):
    id: str = Field(default_factory=lambda: _id("usage"))
    project_id: str
    run_id: str = ""
    provider: str = ""
    model: str = ""
    input_tokens: int = 0
    output_tokens: int = 0
    total_tokens: int = 0
    cost: float | None = None  # provider-reported or calculated; None if unknown
    cost_is_estimate: bool = True
    status: UsageStatus = UsageStatus.OK
    timestamp: float = Field(default_factory=_now)


class BudgetPauseRecord(BaseModel):
    """Persisted so a paused execution can be resumed after a restart."""

    id: str = Field(default_factory=lambda: _id("pause"))
    project_id: str
    execution_id: str
    task_id: str
    reason: str
    limit: float
    used: float
    remaining: float
    mode: BudgetMode
    created_at: float = Field(default_factory=_now)
    resolved: bool = False
