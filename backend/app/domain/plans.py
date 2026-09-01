"""Plan versioning.

A plan is immutable once published. Any edit — including a changed
tech decision (e.g. Supabase → Firebase) — produces a NEW version.
Versions are chained, numbered, and remember why they exist.
"""
from __future__ import annotations

import time
from dataclasses import dataclass, field

from app.domain.graph import DependencyGraph
from app.domain.models import (
    ArchitectureDecision,
    Milestone,
    Requirement,
    Task,
    TechDecision,
)


@dataclass
class PlanVersion:
    version: int
    goal: str
    context: str = ""
    requirements: list[Requirement] = field(default_factory=list)
    architecture: list[ArchitectureDecision] = field(default_factory=list)
    technology: list[TechDecision] = field(default_factory=list)
    milestones: list[Milestone] = field(default_factory=list)
    tasks: list[Task] = field(default_factory=list)
    reason: str = "initial plan"
    created_at: float = field(default_factory=time.time)
    parent_version: int | None = None

    def graph(self) -> DependencyGraph:
        return DependencyGraph(self.tasks)

    def tech_decision(self, category: str) -> TechDecision | None:
        for t in self.technology:
            if t.category == category:
                return t
        return None

    def to_dict(self) -> dict:
        return {
            "version": self.version,
            "goal": self.goal,
            "context": self.context,
            "requirements": [r.model_dump(mode="json") for r in self.requirements],
            "architecture": [a.model_dump(mode="json") for a in self.architecture],
            "technology": [t.model_dump(mode="json") for t in self.technology],
            "milestones": [m.model_dump(mode="json") for m in self.milestones],
            "tasks": [t.model_dump(mode="json") for t in self.tasks],
            "reason": self.reason,
            "created_at": self.created_at,
            "parent_version": self.parent_version,
        }


class PlanStore:
    """Keeps every version; the latest is always the working plan."""

    def __init__(self, project_id: str) -> None:
        self.project_id = project_id
        self._versions: dict[int, PlanVersion] = {}

    def add(self, version: PlanVersion) -> None:
        self._versions[version.version] = version

    def latest(self) -> PlanVersion | None:
        if not self._versions:
            return None
        return self._versions[max(self._versions)]

    def get(self, version: int) -> PlanVersion | None:
        return self._versions.get(version)

    def versions(self) -> list[PlanVersion]:
        return sorted(self._versions.values(), key=lambda v: v.version)

    def history(self) -> list[dict]:
        return [
            {
                "version": v.version,
                "reason": v.reason,
                "created_at": v.created_at,
                "parent": v.parent_version,
            }
            for v in self.versions()
        ]
