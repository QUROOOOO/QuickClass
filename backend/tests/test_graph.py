"""Dependency graph: readiness, cascading invalidation, cycle detection."""
from app.domain.graph import DependencyGraph
from app.domain.models import Task, TaskStatus


def make_task(id, depends=()):
    return Task(id=id, project_id="p1", title=id, depends_on=list(depends))


def test_ready_front():
    a, b, c = make_task("a"), make_task("b", ["a"]), make_task("c", ["a", "b"])
    g = DependencyGraph([a, b, c])
    assert [t.id for t in g.ready_tasks()] == ["a"]


def test_cascade_invalidation():
    a, b, c = make_task("a"), make_task("b", ["a"]), make_task("c", ["b"])
    d = make_task("d")
    g = DependencyGraph([a, b, c, d])
    invalidated = g.invalidate_cascade("a")
    assert set(invalidated) == {"b", "c"}
    assert "d" not in invalidated


def test_invalidation_skips_done_dependents_logic():
    a, b = make_task("a"), make_task("b", ["a"])
    b.status = TaskStatus.DONE
    g = DependencyGraph([a, b])
    # cascade still reports b: done work becomes stale when a changes
    assert g.invalidate_cascade("a") == ["b"]


def test_cycle_detected():
    a, b = make_task("a", ["b"]), make_task("b", ["a"])
    g = DependencyGraph([a, b])
    assert g.cycle_check()
