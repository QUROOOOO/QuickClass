"""Typed domain events — the backbone of the system.

Every meaningful thing that happens in a project is an Event.
Events are immutable, typed, and can be replayed. The event bus
streams them to SSE subscribers and to the audit log.
"""
from __future__ import annotations

import asyncio
import time
import uuid
from typing import Any, Callable, Literal

from pydantic import BaseModel, Field


class DomainEvent(BaseModel):
    event_id: str = Field(default_factory=lambda: uuid.uuid4().hex)
    type: str
    project_id: str | None = None
    occurred_at: float = Field(default_factory=time.time)
    payload: dict[str, Any] = Field(default_factory=dict)

    def __str__(self) -> str:  # pragma: no cover - convenience
        return f"{self.type} [{self.event_id[:8]}]"


def ev(type: str, project_id: str | None = None, **payload) -> DomainEvent:
    return DomainEvent(type=type, project_id=project_id, payload=payload)


# --- well-known event types -------------------------------------------------

PROJECT_CREATED = "project.created"
PROJECT_STATE_CHANGED = "project.state_changed"
PROJECT_COMPLETED = "project.completed"
PROJECT_FAILED = "project.failed"

GOAL_UPDATED = "goal.updated"
REQUIREMENT_ADDED = "requirement.added"

PLAN_CREATED = "plan.created"
PLAN_VERSION_CREATED = "plan.version_created"
PLAN_EDITED = "plan.edited"
PLAN_DEPENDENCY_INVALIDATED = "plan.dependency_invalidated"
PLAN_SUBMITTED = "plan.submitted"
PLAN_APPROVED = "plan.approved"
PLAN_REJECTED = "plan.rejected"
PLAN_APPROVAL_REQUESTED = "approval.requested"

EXECUTION_STARTED = "execution.started"
AGENT_RUN_STARTED = "agent_run.started"
AGENT_RUN_COMPLETED = "agent_run.completed"
AGENT_RUN_FAILED = "agent_run.failed"
TOOL_CALLED = "tool.called"
TOOL_SUCCEEDED = "tool.succeeded"
TOOL_FAILED = "tool.failed"
TOOL_NEEDS_APPROVAL = "tool.needs_approval"
TOOL_RETRY = "tool.retry"
ARTIFACT_CREATED = "artifact.created"
TASK_COMPLETED = "task.completed"
TASK_FAILED = "task.failed"

VERIFICATION_REQUESTED = "verification.requested"
VERIFICATION_SUCCEEDED = "verification.succeeded"
VERIFICATION_FAILED = "verification.failed"

APPROVAL_RESOLVED = "approval.resolved"

# --- event bus --------------------------------------------------------------

Subscriber = Callable[[DomainEvent], Any]


class EventBus:
    """In-process typed event bus with an async fan-out for SSE."""

    def __init__(self) -> None:
        self._subs: list[Subscriber] = []
        self._queues: set[asyncio.Queue[DomainEvent | None]] = set()

    def subscribe(self, fn: Subscriber) -> None:
        self._subs.append(fn)

    def publish(self, event: DomainEvent) -> None:
        for fn in self._subs:
            try:
                fn(event)
            except Exception:  # never let a subscriber break the bus
                pass
        for q in list(self._queues):
            q.put_nowait(event)

    def stream(self) -> asyncio.Queue[DomainEvent | None]:
        q: asyncio.Queue[DomainEvent | None] = asyncio.Queue()
        self._queues.add(q)
        return q

    def unstream(self, q: asyncio.Queue[DomainEvent | None]) -> None:
        self._queues.discard(q)


bus = EventBus()


class AuditLog:
    """Appends every event to a JSONL file when file logging is enabled."""

    def __init__(self, path: str | None = None) -> None:
        self.path = path

    def __call__(self, event: DomainEvent) -> None:
        if not self.path:
            return
        import json

        with open(self.path, "a", encoding="utf-8") as f:
            f.write(json.dumps(event.model_dump()) + "\n")


def wire_audit_log(path: str | None) -> None:
    bus.subscribe(AuditLog(path))
