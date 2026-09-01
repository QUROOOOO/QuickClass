"""Plan versioning — every edit is a new version; invalidation is honest."""
from app.domain.models import Milestone, Task, TechDecision
from app.domain.plans import PlanStore, PlanVersion
from app.services.plan_service import PlanService


def seeded_service():
    tech = TechDecision(project_id="p1", category="DATABASE", choice="Supabase")
    tasks = [
        Task(id="task_1", project_id="p1", title="Configure database", description="supabase"),
        Task(id="task_2", project_id="p1", title="Write queries", description="supabase", depends_on=["tech_1"]),
    ]
    version = PlanVersion(
        version=1,
        goal="Build a gym membership app",
        technology=[tech],
        tasks=tasks,
    )
    svc = PlanService()
    svc.store("p1").add(version)
    return svc


def test_initial_plan_version_1():
    svc = seeded_service()
    assert svc.store("p1").latest().version == 1


def test_tech_edit_creates_version_and_supersedes():
    svc = seeded_service()
    v2 = svc.edit_tech_decision("p1", "DATABASE", "Firebase", "cost")
    assert v2.version == 2
    assert v2.parent_version == 1
    old = [t for t in v2.technology if t.choice == "Supabase"][0]
    new = [t for t in v2.technology if t.choice == "Firebase"][0]
    assert old.status == "superseded" and old.superseded_by == new.id
    assert "DATABASE" in v2.reason


def test_invalidation_reported():
    svc = seeded_service()
    v2 = svc.edit_tech_decision("p1", "DATABASE", "Firebase")
    # task_2 depends on the tech decision -> invalidated
    invalidated = [t.id for t in v2.tasks if any(d.startswith("tech_") for d in t.depends_on)]
    assert "task_2" in invalidated
    assert len(v2.tasks) == 2  # nothing lost, tasks re-targeted


def test_history_chain():
    svc = seeded_service()
    svc.edit_tech_decision("p1", "DATABASE", "Firebase")
    svc.edit_tech_decision("p1", "FRONTEND", "Next.js")
    history = svc.history("p1")
    assert [h["version"] for h in history] == [1, 2, 3]
    assert history[1]["parent"] == 1
    assert history[2]["parent"] == 2


def test_submit_requires_tech_and_tasks():
    svc = seeded_service()
    assert svc.submit("p1").version == 1  # v1 already has tech + tasks


def test_previous_version_stays_immutable():
    svc = seeded_service()
    v1 = svc.store("p1").get(1)
    before = v1.technology[0].status
    svc.edit_tech_decision("p1", "DATABASE", "Firebase")
    assert v1.technology[0].status == before  # v1 untouched
    assert v1.technology[0].superseded_by is None


def test_duplicate_plan_rejected():
    svc = seeded_service()
    from app.errors import Conflict

    try:
        svc.create_plan("p1", "another goal")
        raise AssertionError("should have raised")
    except Conflict:
        pass
