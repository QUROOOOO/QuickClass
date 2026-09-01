"""Project state machine — explicit, legal, testable.

States: draft → planning → awaiting_review → approved → executing
→ testing → reviewing → repairing → verified → completed
with blocked / failed as terminal or pause states.
"""
from __future__ import annotations

from enum import StrEnum

from app.domain.models import ProjectStatus
from app.errors import Conflict


class TransitionError(Conflict):
    def __init__(self, current: ProjectStatus, target: ProjectStatus):
        super().__init__(
            f"Cannot move project from {current.value} to {target.value}.",
            current=current.value,
            target=target.value,
        )


# explicit legal transitions
_TRANSITIONS: dict[ProjectStatus, set[ProjectStatus]] = {
    ProjectStatus.DRAFT: {ProjectStatus.PLANNING, ProjectStatus.BLOCKED, ProjectStatus.FAILED},
    ProjectStatus.PLANNING: {
        ProjectStatus.AWAITING_REVIEW,
        ProjectStatus.BLOCKED,
        ProjectStatus.FAILED,
        ProjectStatus.PLANNING,  # replanning stays in planning
    },
    ProjectStatus.AWAITING_REVIEW: {
        ProjectStatus.APPROVED,
        ProjectStatus.PLANNING,  # rejected → back to planning
        ProjectStatus.BLOCKED,
        ProjectStatus.FAILED,
    },
    ProjectStatus.APPROVED: {ProjectStatus.EXECUTING, ProjectStatus.BLOCKED, ProjectStatus.FAILED},
    ProjectStatus.EXECUTING: {
        ProjectStatus.TESTING,
        ProjectStatus.REPAIRING,
        ProjectStatus.BLOCKED,
        ProjectStatus.BUDGET_PAUSED,
        ProjectStatus.FAILED,
        ProjectStatus.COMPLETED,
    },
    ProjectStatus.BUDGET_PAUSED: {ProjectStatus.EXECUTING, ProjectStatus.FAILED},
    ProjectStatus.TESTING: {
        ProjectStatus.REVIEWING,
        ProjectStatus.REPAIRING,
        ProjectStatus.BLOCKED,
        ProjectStatus.FAILED,
    },
    ProjectStatus.REVIEWING: {
        ProjectStatus.VERIFIED,
        ProjectStatus.REPAIRING,
        ProjectStatus.BLOCKED,
        ProjectStatus.FAILED,
    },
    ProjectStatus.REPAIRING: {
        ProjectStatus.TESTING,
        ProjectStatus.BLOCKED,
        ProjectStatus.FAILED,
    },
    ProjectStatus.VERIFIED: {ProjectStatus.COMPLETED, ProjectStatus.REVIEWING},
    ProjectStatus.COMPLETED: set(),
    ProjectStatus.BLOCKED: {
        ProjectStatus.PLANNING,
        ProjectStatus.EXECUTING,
        ProjectStatus.TESTING,
        ProjectStatus.REVIEWING,
        ProjectStatus.REPAIRING,
    },
    ProjectStatus.FAILED: {ProjectStatus.PLANNING, ProjectStatus.REPAIRING},
}


def can_transition(current: ProjectStatus, target: ProjectStatus) -> bool:
    return target in _TRANSITIONS.get(current, set())


def transition(current: ProjectStatus, target: ProjectStatus) -> ProjectStatus:
    if current == target:
        return current
    if not can_transition(current, target):
        raise TransitionError(current, target)
    return target
