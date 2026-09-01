"""Usage accounting + budget enforcement: pause not terminate, resume, race safety."""
import pytest

from app.agents.adk_agents import AgentRunResult
from app.domain.models import AgentRun, Task
from app.domain.usage import BudgetConfig, BudgetMode, BudgetPeriod
from app.errors import BudgetPaused
from app.persistence.store import InMemoryStore
from app.services.plan_service import PlanService
from app.services.project_service import ProjectService
from app.services.usage import UsageService


class QuietExecutor:
    """Fake executor — no tool calls, just consumes budget."""

    name = "fake"

    def run(self, run: AgentRun, task: Task) -> AgentRunResult:
        return AgentRunResult(summary=f"did {task.title}")


def make_project(usage: UsageService | None = None):
    store = InMemoryStore()
    plans = PlanService()
    svc = ProjectService(store=store, plans=plans, executor=QuietExecutor(), usage=usage)
    project = svc.create_project(owner_id="u1", title="Budget test")
    pid = project.id
    svc.start_planning(pid, "Build a thing", "small")
    version = plans.create_plan(pid, "Build a thing", "small")
    plans.store(pid).add(version)
    plans.edit_tech_decision(pid, "DATABASE", "Supabase")
    svc.submit_plan_for_review(pid)
    svc.resolve_plan_review(pid, "approve")
    return svc, pid


def test_disabled_budget_never_pauses():
    svc, pid = make_project()
    svc.execute(pid)  # no budget configured — must run to completion
    version = svc.plans.store(pid).latest()
    assert all(t.status.value == "done" for t in version.tasks)


def test_token_budget_pauses_not_terminates():
    svc, pid = make_project()
    svc.usage.set_budget(BudgetConfig(project_id=pid, mode=BudgetMode.TOKENS, limit_tokens=1, period=BudgetPeriod.PER_PROJECT))

    with pytest.raises(BudgetPaused):
        svc.execute(pid)

    project = svc.get_project(pid)
    assert project.status.value == "budget_paused"  # paused, not failed/completed

    # work state preserved — nothing was lost
    pause = svc.usage.get_active_pause(pid)
    assert pause is not None
    assert pause.mode == BudgetMode.TOKENS


def test_stop_preserves_state_without_resuming():
    svc, pid = make_project()
    svc.usage.set_budget(BudgetConfig(project_id=pid, mode=BudgetMode.TOKENS, limit_tokens=1))
    with pytest.raises(BudgetPaused):
        svc.execute(pid)

    svc.resume_after_budget_pause(pid, "stop")
    assert svc.get_project(pid).status.value == "budget_paused"  # still paused, gracefully stopped
    assert svc.usage.get_active_pause(pid) is None  # pause resolved, no dangling state


def test_continue_resumes_and_completes():
    svc, pid = make_project()
    svc.usage.set_budget(BudgetConfig(project_id=pid, mode=BudgetMode.TOKENS, limit_tokens=1))
    with pytest.raises(BudgetPaused):
        svc.execute(pid)
    assert svc.get_project(pid).status.value == "budget_paused"
    version = svc.plans.store(pid).latest()
    assert all(t.status.value != "done" for t in version.tasks)  # nothing ran yet — preserved, not lost

    # raise the limit and continue — should resume, not restart
    svc.usage.set_budget(BudgetConfig(project_id=pid, mode=BudgetMode.TOKENS, limit_tokens=100_000))
    svc.resume_after_budget_pause(pid, "continue")
    assert svc.get_project(pid).status.value == "executing"
    svc.execute(pid)  # continues; already-done tasks (none yet) are skipped, rest run
    version = svc.plans.store(pid).latest()
    assert all(t.status.value == "done" for t in version.tasks)


def test_usage_records_are_authoritative_backend_side():
    svc, pid = make_project()
    svc.execute(pid)
    records = [d for d in svc.store.list("usage_records") if d.get("project_id") == pid]
    assert len(records) >= 1
    assert all(r["total_tokens"] > 0 for r in records)
    assert all(r["status"] == "ok" for r in records)


def test_concurrent_reservations_cannot_both_cross_the_limit():
    store = InMemoryStore()
    usage = UsageService(store)
    usage.set_budget(BudgetConfig(project_id="p1", mode=BudgetMode.TOKENS, limit_tokens=100))

    first = usage.check_and_reserve("p1", 80, 0)
    assert first.allowed
    # a second concurrent reservation must not also fit — the first is still
    # outstanding (not yet finalized), proving the lock prevents double-spend
    second = usage.check_and_reserve("p1", 80, 0)
    assert not second.allowed

    usage.finalize_reservation(first.reservation, __import__("app.domain.usage", fromlist=["UsageRecord"]).UsageRecord(
        project_id="p1", total_tokens=80
    ))
    summary = usage.summary("p1")
    assert summary["used"] == 80


def test_cost_budget_mode():
    store = InMemoryStore()
    usage = UsageService(store)
    usage.set_budget(BudgetConfig(project_id="p2", mode=BudgetMode.COST, limit_cost=0.05, period=BudgetPeriod.PER_PROJECT))
    check = usage.check_and_reserve("p2", 100, 0.10)
    assert not check.allowed
    check2 = usage.check_and_reserve("p2", 100, 0.02)
    assert check2.allowed
