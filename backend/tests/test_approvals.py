"""Approval gate: risky tool calls pause execution, approvals resume it."""
import pytest

from app.agents.adk_agents import AgentRunResult
from app.domain.models import AgentRun, Approval, Task, ToolCall
from app.errors import ApprovalRequired
from app.persistence.store import InMemoryStore
from app.services.plan_service import PlanService
from app.services.project_service import ProjectService


class ProposingExecutor:
    """Fake executor that proposes a deploy.publish — the risky tool."""

    name = "fake"

    def run(self, run: AgentRun, task: Task) -> AgentRunResult:
        return AgentRunResult(
            summary=f"proposed work for {task.title}",
            tool_calls=[ToolCall(project_id=run.project_id, run_id=run.id, tool="deploy.publish", args={})],
        )


def make_project() -> tuple[ProjectService, str]:
    store = InMemoryStore()
    plans = PlanService()
    svc = ProjectService(store=store, plans=plans, executor=ProposingExecutor())
    project = svc.create_project(owner_id="u1", title="Launch site")
    pid = project.id
    svc.start_planning(pid, "Launch a site", "small")
    version = plans.create_plan(pid, "Launch a site", "small")
    plans.store(pid).add(version)
    # give the plan a tech decision + a task (reviewable)
    from app.domain.models import TechDecision

    plans.edit_tech_decision(pid, "DATABASE", "Supabase")
    svc.submit_plan_for_review(pid)
    svc.resolve_plan_review(pid, "approve")
    return svc, pid


def test_publish_blocks_execution_and_resumes():
    svc, pid = make_project()
    with pytest.raises(ApprovalRequired):
        svc.execute(pid)
    assert svc.get_project(pid).status.value == "blocked"

    pending = svc.pending_approvals(pid)
    assert len(pending) == 1
    assert pending[0].kind == "tool"

    svc.resolve_approval(pid, pending[0].id, "approve")
    svc.resume_after_approval(pid)
    assert svc.get_project(pid).status.value == "executing"  # re-enters execution


def test_denied_approval_is_terminal_for_that_call():
    svc, pid = make_project()
    with pytest.raises(ApprovalRequired):
        svc.execute(pid)
    pending = svc.pending_approvals(pid)
    approval = svc.resolve_approval(pid, pending[0].id, "deny")
    assert approval.status == "denied"
    # an approved tool call with permission denied never runs again
    assert approval.kind == "tool"
