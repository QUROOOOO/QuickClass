"""Plan service — turning goals into versioned, reviewable plans.

Editing ANY tech decision (Supabase → Firebase) or requirement creates
a new plan version; the dependency graph then invalidates every task
that depended on the old choice, so nothing is re-verified on stale
assumptions.
"""
from __future__ import annotations

from app.domain.events import (
    GOAL_UPDATED,
    PLAN_CREATED,
    PLAN_DEPENDENCY_INVALIDATED,
    PLAN_EDITED,
    PLAN_VERSION_CREATED,
    bus,
    ev,
)
from app.domain.models import (
    ArchitectureDecision,
    DecisionStatus,
    Goal,
    Milestone,
    Requirement,
    Task,
    TechDecision,
)
from app.domain.plans import PlanStore, PlanVersion
from app.errors import Conflict, NotFound


class PlanService:
    """One PlanStore per project — versions never bleed across projects."""

    def __init__(self) -> None:
        self._stores: dict[str, PlanStore] = {}

    def store(self, project_id: str) -> PlanStore:
        return self._stores.setdefault(project_id, PlanStore(project_id))

    def create_plan(
        self,
        project_id: str,
        goal: str,
        context: str = "",
        requirements: list[Requirement] | None = None,
        architecture: list[ArchitectureDecision] | None = None,
        technology: list[TechDecision] | None = None,
        milestones: list[Milestone] | None = None,
        tasks: list[Task] | None = None,
    ) -> PlanVersion:
        store = self.store(project_id)
        if store.latest() is not None:
            raise Conflict(
                "A plan already exists for this project.",
                project_id=project_id,
                version=store.latest().version,
            )
        # an empty plan is not reviewable — seed a minimal honest skeleton
        # (a proposed default stack + one task) that the human edits
        if not technology and not tasks:
            technology = [
                TechDecision(
                    project_id=project_id,
                    category="DATABASE",
                    choice="Supabase",
                    status=DecisionStatus.PROPOSED,
                    reason="initial proposal — change it in planning",
                )
            ]
            tasks = [
                Task(
                    id=f"task_seed_{project_id[-8:]}",
                    project_id=project_id,
                    title="Configure the database",
                    description="Wire up the selected database (Supabase) for the project.",
                    depends_on=[technology[0].id],
                )
            ]
        version = PlanVersion(
            version=1,
            goal=goal,
            context=context,
            requirements=requirements or [],
            architecture=architecture or [],
            technology=technology or [],
            milestones=milestones or [],
            tasks=tasks or [],
            reason="initial plan",
        )
        store.add(version)
        bus.publish(ev(PLAN_CREATED, project_id, version=1, goal=goal[:200]))
        return version

    def update_goal(self, project_id: str, statement: str, context: str = "") -> Goal:
        goal = Goal(id=f"goal_{project_id}", project_id=project_id, statement=statement, context=context)
        bus.publish(ev(GOAL_UPDATED, project_id, statement=statement[:200]))
        return goal

    def edit_tech_decision(
        self,
        project_id: str,
        category: str,
        choice: str,
        reason: str = "",
        supersede_old: bool = True,
    ) -> PlanVersion:
        """Change a tech decision → NEW plan version + cascade invalidation.

        The previous version stays immutable; only the new version sees
        the supersession and re-targeted tasks.
        """
        store = self.store(project_id)
        latest = store.latest()
        if latest is None:
            raise NotFound("plan", project_id)

        old = latest.tech_decision(category)
        new_decision = TechDecision(
            project_id=project_id, category=category, choice=choice, reason=reason
        )

        technology = []
        for t in latest.technology:
            copy = t.model_copy(deep=True)
            if copy.category == category and supersede_old and old is not None:
                copy.status = DecisionStatus.SUPERSEDED
                copy.superseded_by = new_decision.id
            technology.append(copy)
        technology.append(new_decision)

        # tasks that depended on the old choice get re-targeted + invalidated
        tasks = [t.model_copy(deep=True) for t in latest.tasks]
        invalidated: list[str] = []
        if old is not None:
            for t in tasks:
                if old.id in t.depends_on or old.choice.lower() in t.description.lower():
                    invalidated.append(t.id)
                    t.depends_on = [d for d in t.depends_on if d != old.id]
                    t.depends_on.append(new_decision.id)

        version = PlanVersion(
            version=latest.version + 1,
            goal=latest.goal,
            context=latest.context,
            requirements=latest.requirements,
            architecture=latest.architecture,
            technology=technology,
            milestones=latest.milestones,
            tasks=tasks,
            reason=f"tech decision {category}: {old.choice if old else '(none)'} → {choice}",
            parent_version=latest.version,
        )
        store.add(version)
        bus.publish(ev(PLAN_VERSION_CREATED, project_id, version=version.version, reason=version.reason))
        bus.publish(ev(PLAN_EDITED, project_id, version=version.version, category=category, choice=choice))
        bus.publish(
            ev(
                PLAN_DEPENDENCY_INVALIDATED,
                project_id,
                version=version.version,
                invalidated_task_ids=invalidated,
                count=len(invalidated),
            )
        )
        return version

    def submit(self, project_id: str) -> PlanVersion:
        latest = self.store(project_id).latest()
        if latest is None:
            raise NotFound("plan", project_id)
        if not latest.technology:
            raise Conflict("A plan needs at least one tech decision before review.")
        if not latest.tasks:
            raise Conflict("A plan needs tasks before review.")
        bus.publish(ev("plan.submitted", project_id, version=latest.version))
        return latest

    def approve(self, project_id: str) -> PlanVersion:
        latest = self.store(project_id).latest()
        if latest is None:
            raise NotFound("plan", project_id)
        bus.publish(ev("plan.approved", project_id, version=latest.version))
        return latest

    def reject(self, project_id: str, reason: str) -> PlanVersion:
        latest = self.store(project_id).latest()
        if latest is None:
            raise NotFound("plan", project_id)
        bus.publish(ev("plan.rejected", project_id, version=latest.version, reason=reason[:400]))
        return latest

    def history(self, project_id: str) -> list[dict]:
        return self.store(project_id).history()

    def graph_ready(self, project_id: str, version: int | None = None) -> list[str]:
        store = self.store(project_id)
        v = store.get(version) if version else store.latest()
        if v is None:
            return []
        return [t.id for t in v.graph().ready_tasks()]
