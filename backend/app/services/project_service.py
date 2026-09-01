"""Project orchestration — the flow that turns a goal into a verified build.

goal → plan (versioned) → review → approval → execution (agent runs,
tool calls with policy + approvals + bounded retries) → verification
(evidence-backed) → review → verified → completed.

Every step emits typed events; failures are honest and recoverable.
"""
from __future__ import annotations

import threading
from typing import Any

from app.domain.events import (
    AGENT_RUN_COMPLETED,
    AGENT_RUN_FAILED,
    AGENT_RUN_STARTED,
    APPROVAL_RESOLVED,
    EXECUTION_STARTED,
    PLAN_APPROVAL_REQUESTED,
    PLAN_APPROVED,
    PLAN_CREATED,
    PLAN_REJECTED,
    PLAN_SUBMITTED,
    PROJECT_COMPLETED,
    PROJECT_CREATED,
    PROJECT_FAILED,
    PROJECT_STATE_CHANGED,
    TASK_COMPLETED,
    TASK_FAILED,
    VERIFICATION_FAILED,
    VERIFICATION_SUCCEEDED,
    bus,
    ev,
)
from app.domain.models import (
    AgentRun,
    Approval,
    Artifact,
    Execution,
    Finding,
    Project,
    ProjectStatus,
    Review,
    Task,
    TaskStatus,
    ToolCall,
)
from app.config import get_settings
from app.domain.state import ProjectStatus as PS
from app.domain.state import transition
from app.domain.usage import BudgetMode, UsageRecord, UsageStatus
from app.errors import ApprovalRequired, BudgetPaused, Conflict, NotFound
from app.persistence.store import Store
from app.services.plan_service import PlanService
from app.services.tool_gateway import ToolGateway
from app.services.tool_registry import ToolRegistry
from app.services.tools import execute_tool_call
from app.services.usage import UsageService
from app.services.verification import verify_task


class ProjectService:
    def __init__(
        self,
        store: Store,
        plans: PlanService,
        executor=None,
        tool_policy: dict | None = None,
        usage: UsageService | None = None,
    ) -> None:
        self.store = store
        self.plans = plans
        self.executor = executor  # AgentRuntime | None — None = plan-only mode
        self._lock = threading.Lock()
        self._tool_policy = tool_policy or {}
        self.usage = usage or UsageService(store)
        self.tool_gateway = ToolGateway(ToolRegistry(store))

    # ---- storage helpers --------------------------------------------------

    def _save(self, entity: Any, collection: str) -> None:
        data = entity.model_dump(mode="json")
        data["_kind"] = entity.__class__.__name__
        self.store.put(collection, entity.id, data)

    def _load(self, collection: str, id: str, cls: type) -> Any:
        data = self.store.get(collection, id)
        if data is None:
            raise NotFound(collection, id)
        return cls(**data)

    def _save_many(self, entities: list, collection: str) -> None:
        for e in entities:
            self._save(e, collection)

    # ---- projects ----------------------------------------------------------

    def create_project(self, owner_id: str, title: str) -> Project:
        project = Project(owner_id=owner_id, title=title)
        self._save(project, "projects")
        bus.publish(ev(PROJECT_CREATED, project.id, title=title))
        return project

    def get_project(self, project_id: str) -> Project:
        return self._load("projects", project_id, Project)

    def list_projects(self, owner_id: str) -> list[Project]:
        docs = self.store.list("projects", owner_id=owner_id)
        return sorted(
            [Project(**d) for d in docs],
            key=lambda p: p.updated_at,
            reverse=True,
        )

    def set_status(self, project: Project, target: ProjectStatus) -> Project:
        with self._lock:
            previous = project.status
            project.status = transition(previous, target)
            if project.status != previous:
                project.updated_at = __import__("time").time()
                self._save(project, "projects")
                bus.publish(
                    ev(PROJECT_STATE_CHANGED, project.id, previous=previous.value, current=project.status.value)
                )
        return project

    # ---- the flow -----------------------------------------------------------

    def start_planning(self, project_id: str, goal: str, context: str = "") -> Project:
        project = self.get_project(project_id)
        self.plans.update_goal(project_id, goal, context)
        return self.set_status(project, PS.PLANNING)

    def submit_plan_for_review(self, project_id: str) -> Project:
        project = self.get_project(project_id)
        version = self.plans.submit(project_id)
        review = Review(project_id=project_id, plan_version=version.version, summary="Plan ready for review.")
        self._save(review, "reviews")
        project = self.set_status(project, PS.AWAITING_REVIEW)
        bus.publish(ev(PLAN_SUBMITTED, project_id, version=version.version))
        bus.publish(ev(PLAN_APPROVAL_REQUESTED, project_id, version=version.version, review_id=review.id))
        return project

    def resolve_plan_review(self, project_id: str, decision: str, reason: str = "") -> Project:
        """decision: 'approve' | 'reject'"""
        project = self.get_project(project_id)
        if project.status not in (PS.AWAITING_REVIEW, PS.APPROVED):
            raise Conflict(f"Project is {project.status.value}; cannot resolve a plan review now.")
        reviews = [Review(**d) for d in self.store.list("reviews") if d.get("project_id") == project_id]
        open_review = next((r for r in reviews if r.status == "open"), None)
        if open_review is None:
            raise NotFound("open review", project_id)
        if decision == "approve":
            open_review.status = "approved"
            open_review.resolved_at = __import__("time").time()
            self._save(open_review, "reviews")
            self.plans.approve(project_id)
            bus.publish(ev(PLAN_APPROVED, project_id, version=open_review.plan_version))
            return self.set_status(project, PS.APPROVED)
        open_review.status = "rejected"
        open_review.resolved_at = __import__("time").time()
        self._save(open_review, "reviews")
        self.plans.reject(project_id, reason)
        bus.publish(ev(PLAN_REJECTED, project_id, reason=reason[:400]))
        return self.set_status(project, PS.PLANNING)

    def execute(self, project_id: str, plan_version: int | None = None) -> Execution:
        project = self.get_project(project_id)
        version = self.plans.store(project_id).get(plan_version) if plan_version else self.plans.store(project_id).latest()
        if version is None:
            raise NotFound("plan", project_id)
        if project.status not in (PS.APPROVED, PS.EXECUTING):
            raise Conflict(f"Project is {project.status.value}; approve the plan before executing.")

        execution = Execution(project_id=project_id, plan_version=version.version)
        self._save(execution, "executions")
        bus.publish(ev(EXECUTION_STARTED, project_id, execution_id=execution.id, plan_version=version.version))
        self.set_status(project, PS.EXECUTING)

        tasks = sorted(version.tasks, key=lambda t: t.id)
        try:
            for task in tasks:
                if task.status == TaskStatus.DONE:
                    continue  # already completed before an approval pause
                self._run_task(project_id, execution, task)
        except ApprovalRequired as exc:
            self.set_status(project, PS.BLOCKED)
            raise ApprovalRequired(
                f"Execution paused awaiting approval: {exc.message}",
                approval_id=exc.details.get("approval_id", ""),
            ) from exc
        except BudgetPaused as exc:
            self.set_status(project, PS.BUDGET_PAUSED)
            raise
        except Exception as exc:
            self.set_status(project, PS.FAILED)
            bus.publish(ev(PROJECT_FAILED, project_id, error=str(exc)))
            raise

        execution.finished_at = __import__("time").time()
        execution.status = "succeeded"
        self._save(execution, "executions")
        project = self.get_project(project_id)
        return execution

    def _run_task(self, project_id: str, execution: Execution, task: Task) -> None:
        task.status = TaskStatus.RUNNING
        run = AgentRun(
            project_id=project_id,
            execution_id=execution.id,
            role=task.agent,
            task_id=task.id,
        )
        self._save(run, "runs")
        bus.publish(ev(AGENT_RUN_STARTED, project_id, run_id=run.id, task_id=task.id, role=run.role.value))

        calls: list[ToolCall] = []
        if self.executor is not None:
            settings = get_settings()
            est_tokens = settings.budget_estimate_tokens_per_task
            est_cost = settings.budget_estimate_cost_per_task
            check = self.usage.check_and_reserve(project_id, est_tokens, est_cost)
            if not check.allowed:
                run.status = "needs_approval"
                run.finished_at = __import__("time").time()
                self._save(run, "runs")
                pause = self.usage.create_pause(
                    project_id=project_id,
                    execution_id=execution.id,
                    task_id=task.id,
                    reason="usage limit reached",
                    limit=check.limit,
                    used=check.used,
                    remaining=check.remaining,
                    mode=check.mode,
                )
                bus.publish(
                    ev(
                        "budget.limit_reached",
                        project_id,
                        pause_id=pause.id,
                        task_id=task.id,
                        limit=check.limit,
                        used=check.used,
                        remaining=check.remaining,
                        mode=check.mode.value,
                    )
                )
                raise BudgetPaused(
                    f"Usage limit reached ({check.mode.value}): {check.used:.2f}/{check.limit:.2f} used.",
                    pause_id=pause.id,
                    limit=check.limit,
                    used=check.used,
                    remaining=check.remaining,
                    mode=check.mode.value,
                )

            try:
                result = self.executor.run(run, task)
            except Exception:
                self.usage.release_reservation(check.reservation)
                raise
            actual_tokens = result.input_tokens + result.output_tokens
            record = UsageRecord(
                project_id=project_id,
                run_id=run.id,
                provider="local",
                model=getattr(self.executor, "name", "unknown"),
                input_tokens=result.input_tokens or est_tokens // 2,
                output_tokens=result.output_tokens or est_tokens - est_tokens // 2,
                total_tokens=actual_tokens or est_tokens,
                cost=est_cost if actual_tokens == 0 else None,
                cost_is_estimate=actual_tokens == 0,
                status=UsageStatus.OK,
            )
            self.usage.finalize_reservation(check.reservation, record)

            run.summary = result.summary
            calls = result.tool_calls
            for call in calls:
                call.run_id = run.id
                call.project_id = project_id
                try:
                    self.tool_gateway.authorize(call.tool)  # Gateway is authoritative — checked before every call
                    executed = execute_tool_call(call, project_id)
                except ApprovalRequired:
                    # the tool paused for human approval — record it, then pause
                    approval = Approval(
                        project_id=project_id,
                        kind="tool",
                        subject=call.id,
                        detail=f"{call.tool} from {run.id}",
                    )
                    self._save(approval, "approvals")
                    run.status = "needs_approval"
                    run.finished_at = __import__("time").time()
                    self._save(run, "runs")
                    raise ApprovalRequired(
                        f"Tool '{call.tool}' needs approval.",
                        approval_id=approval.id,
                        tool=call.tool,
                    )
                if executed.status == "pending":
                    approval = Approval(
                        project_id=project_id,
                        kind="tool",
                        subject=call.id,
                        detail=f"{call.tool} from {run.id}",
                    )
                    self._save(approval, "approvals")
                    run.status = "needs_approval"
                    self._save(run, "runs")
                    raise ApprovalRequired(
                        f"Tool '{call.tool}' needs approval.",
                        approval_id=approval.id,
                        tool=call.tool,
                    )
                if executed.status == "failed":
                    run.status = "failed"
                    run.error = executed.result
                    task.status = TaskStatus.FAILED
                    self._save(run, "runs")
                    self._save(task, "tasks")
                    bus.publish(ev(AGENT_RUN_FAILED, project_id, run_id=run.id, error=executed.result))
                    bus.publish(ev(TASK_FAILED, project_id, task_id=task.id))
                    raise RuntimeError(f"Task {task.id} failed: {executed.result}")
        else:
            # plan-only mode: task marked done with honest evidence note
            run.summary = f"(plan-only) {task.title}"
            task.evidence = ["plan-only mode: no agent runtime configured"]

        artifact = Artifact(
            project_id=project_id,
            run_id=run.id,
            name=f"{task.id}.md",
            kind="note",
            summary=f"work record for {task.title}",
        )
        self._save(artifact, "artifacts")

        checks = verify_task(task, [artifact])
        ok = all(c.ok for c in checks)
        if ok:
            task.status = TaskStatus.DONE
            run.status = "succeeded"
            run.finished_at = __import__("time").time()
            self._save(run, "runs")
            self._save(task, "tasks")
            bus.publish(ev(AGENT_RUN_COMPLETED, project_id, run_id=run.id, task_id=task.id))
            bus.publish(ev(VERIFICATION_SUCCEEDED, project_id, task_id=task.id))
            bus.publish(ev(TASK_COMPLETED, project_id, task_id=task.id))
        else:
            task.status = TaskStatus.FAILED
            run.status = "failed"
            run.error = "verification produced no evidence"
            self._save(run, "runs")
            self._save(task, "tasks")
            bus.publish(ev(VERIFICATION_FAILED, project_id, task_id=task.id))
            bus.publish(ev(AGENT_RUN_FAILED, project_id, run_id=run.id, error=run.error))
            bus.publish(ev(TASK_FAILED, project_id, task_id=task.id))
            raise RuntimeError(f"Task {task.id} failed verification.")

    # ---- approvals -----------------------------------------------------------

    def pending_approvals(self, project_id: str) -> list[Approval]:
        docs = [d for d in self.store.list("approvals") if d.get("project_id") == project_id]
        return [Approval(**d) for d in docs if d.get("status") == "pending"]

    def resolve_approval(self, project_id: str, approval_id: str, decision: str) -> Approval:
        approval = self._load("approvals", approval_id, Approval)
        if approval.status != "pending":
            raise Conflict("Approval already resolved.", approval_id=approval_id)
        approval.status = "approved" if decision == "approve" else "denied"
        approval.resolved_at = __import__("time").time()
        self._save(approval, "approvals")
        bus.publish(
            ev(APPROVAL_RESOLVED, project_id, approval_id=approval_id, decision=decision, kind=approval.kind)
        )
        return approval

    def resume_after_approval(self, project_id: str) -> Project:
        """Re-enter execution after approvals are resolved.

        Already-finished tasks stay done; only the paused work resumes.
        """
        project = self.get_project(project_id)
        if project.status != PS.BLOCKED:
            raise Conflict(f"Project is {project.status.value}; nothing to resume.")
        return self.set_status(project, PS.EXECUTING)

    def resume_after_budget_pause(self, project_id: str, decision: str = "continue") -> Project:
        """'continue' resumes from preserved state; 'stop' leaves it paused,
        stopped gracefully with all completed work intact (nothing lost)."""
        project = self.get_project(project_id)
        if project.status != PS.BUDGET_PAUSED:
            raise Conflict(f"Project is {project.status.value}; nothing to resume.")
        pause = self.usage.get_active_pause(project_id)
        if pause:
            self.usage.resolve_pause(pause.id)
        if decision == "stop":
            bus.publish(ev("budget.stopped", project_id))
            return project
        bus.publish(ev("budget.resumed", project_id))
        return self.set_status(project, PS.EXECUTING)

    def finish(self, project_id: str) -> Project:
        """Verified → completed."""
        project = self.get_project(project_id)
        return self.set_status(project, PS.COMPLETED)

    def complete_project(self, project_id: str) -> Project:
        project = self.finish(project_id)
        bus.publish(ev(PROJECT_COMPLETED, project_id))
        return project
