"""Verification demands evidence — nothing is done on faith."""
from app.domain.models import Artifact, Requirement, Task
from app.services.verification import verify_requirement, verify_task


def test_task_without_artifacts_fails():
    task = Task(id="task_x", project_id="p1", title="Write the landing page")
    checks = verify_task(task, artifacts=[])
    assert not all(c.ok for c in checks)


def test_task_with_evidence_passes():
    task = Task(id="task_y", project_id="p1", title="Write the landing page", evidence=["see run r1"])
    artifact = Artifact(project_id="p1", run_id="r1", name="task_y.md", kind="note", summary="x")
    checks = verify_task(task, artifacts=[artifact])
    assert all(c.ok for c in checks)


def test_requirement_needs_covering_done_tasks():
    req = Requirement(project_id="p1", statement="Members can check in with a QR code")
    no_tasks = verify_requirement(req, [])
    assert not no_tasks.ok
    task = Task(
        id="task_q",
        project_id="p1",
        title="Members can check in with a QR code",
        status="done",
        evidence=["e1"],
    )
    covered = verify_requirement(req, [task])
    assert covered.ok
