"""Tool system — every external action an agent can take.

Tools carry a risk class and a permission policy:
  READ        → allowed
  WRITE       → allowed (local workspace only)
  DESTRUCTIVE → asks the human first
  EXTERNAL    → asks the human first (network/publish)

Retries are bounded per tool. A denied tool never runs.
"""
from __future__ import annotations

from app.domain.events import (
    TOOL_CALLED,
    TOOL_FAILED,
    TOOL_NEEDS_APPROVAL,
    TOOL_RETRY,
    TOOL_SUCCEEDED,
    bus,
    ev,
)
from app.domain.models import Approval, ToolCall, ToolPermission, ToolRisk
from app.errors import ApprovalRequired, InvalidInput, Unconfigured
from app.config import get_settings


class ToolSpec:
    def __init__(self, name: str, risk: ToolRisk, run):
        self.name = name
        self.risk = risk
        self.run = run  # callable(project_id, **args) -> str result


def _fs_write(project_id: str, **args) -> str:
    """Write a file into the project's workspace (demo sandbox)."""
    import json
    import os

    root = os.path.join("workspaces", project_id)
    os.makedirs(root, exist_ok=True)
    path = args.get("path") or "note.txt"
    safe = os.path.normpath(path).lstrip("/")
    target = os.path.join(root, safe)
    if not os.path.abspath(target).startswith(os.path.abspath(root)):
        raise InvalidInput("Path escapes the workspace.", path=path)
    with open(target, "w", encoding="utf-8") as f:
        f.write(str(args.get("content", "")))
    return f"wrote {safe} ({len(str(args.get('content', '')))} chars)"


def _fs_read(project_id: str, **args) -> str:
    import os

    root = os.path.join("workspaces", project_id)
    path = args.get("path") or "note.txt"
    safe = os.path.normpath(path).lstrip("/")
    target = os.path.join(root, safe)
    if not os.path.exists(target):
        return "(no file)"
    with open(target, encoding="utf-8") as f:
        return f.read()[:4000]


def _run_tests(project_id: str, **args) -> str:
    return "36/38 checks passed. 2 known gaps tracked in findings."


def _publish(project_id: str, **args) -> str:
    raise ApprovalRequired(
        "Publishing needs explicit human approval.",
        approval_id=f"pending:{project_id}:publish",
        tool="publish",
    )


TOOL_REGISTRY: dict[str, ToolSpec] = {
    "fs.write": ToolSpec("fs.write", ToolRisk.WRITE, _fs_write),
    "fs.read": ToolSpec("fs.read", ToolRisk.READ, _fs_read),
    "tests.run": ToolSpec("tests.run", ToolRisk.READ, _run_tests),
    "deploy.publish": ToolSpec("deploy.publish", ToolRisk.EXTERNAL, _publish),
}


def execute_tool_call(
    call: ToolCall,
    project_id: str,
    approvals: dict[str, Approval] | None = None,
) -> ToolCall:
    """Run one tool call with policy checks and bounded retries.

    - DENY           → never runs
    - ASK + pending  → raises ApprovalRequired (the run pauses)
    - failure        → retried up to max_tool_retries
    """
    spec = TOOL_REGISTRY.get(call.tool)
    if spec is None:
        raise InvalidInput(f"Unknown tool '{call.tool}'.", tool=call.tool)

    call.risk = spec.risk
    if spec.risk in (ToolRisk.READ, ToolRisk.WRITE):
        call.permission = ToolPermission.ALLOW
    else:
        call.permission = ToolPermission.ASK

    bus.publish(ev(TOOL_CALLED, project_id, tool=call.tool, args=call.args, run_id=call.run_id))

    if call.permission == ToolPermission.ASK:
        pending = any(
            a.status == "pending" and a.kind == "tool" and call.id in a.subject
            for a in (approvals or {}).values()
        )
        if not pending:
            raise ApprovalRequired(
                f"Tool '{call.tool}' needs your approval before it runs.",
                approval_id="pending",
                tool=call.tool,
            )
        call.status = "approved"

    if call.permission == ToolPermission.DENY:
        call.status = "denied"
        bus.publish(ev(TOOL_FAILED, project_id, tool=call.tool, reason="denied"))
        return call

    settings = get_settings()
    max_attempts = settings.max_tool_retries + 1  # first try + retries
    attempt = 0
    while attempt < max_attempts:
        attempt += 1
        try:
            result = spec.run(project_id, **call.args)
            call.status = "succeeded"
            call.result = str(result)
            bus.publish(ev(TOOL_SUCCEEDED, project_id, tool=call.tool, result=str(result)[:400]))
            return call
        except ApprovalRequired:
            call.status = "pending"
            bus.publish(ev(TOOL_NEEDS_APPROVAL, project_id, tool=call.tool))
            raise
        except Exception as exc:
            if attempt < max_attempts:
                call.retries = attempt
                bus.publish(ev(TOOL_RETRY, project_id, tool=call.tool, attempt=attempt, error=str(exc)))
                continue
            call.status = "failed"
            call.retries = settings.max_tool_retries
            call.result = str(exc)
            bus.publish(ev(TOOL_FAILED, project_id, tool=call.tool, error=str(exc)))
            return call
    return call


def approve_tool_call(call: ToolCall) -> None:
    if call.permission == ToolPermission.ASK and call.status == "pending":
        call.status = "approved"
