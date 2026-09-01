"""Dependency graph with recursive invalidation.

Tasks reference their dependencies; a change to any node cascades:
every task that (transitively) depends on it is invalidated and must
be re-executed. Invalidation is recorded so plan versions can explain
WHY they were created.
"""
from __future__ import annotations

from app.domain.models import Task


class DependencyGraph:
    def __init__(self, tasks: list[Task] | None = None) -> None:
        self._tasks: dict[str, Task] = {}
        self._dependents: dict[str, set[str]] = {}
        if tasks:
            for t in tasks:
                self.add(t)

    def add(self, task: Task) -> None:
        self._tasks[task.id] = task
        self._dependents.setdefault(task.id, set())
        for dep in task.depends_on:
            self._dependents.setdefault(dep, set()).add(task.id)

    def get(self, task_id: str) -> Task | None:
        return self._tasks.get(task_id)

    def all(self) -> list[Task]:
        return list(self._tasks.values())

    def dependents_of(self, task_id: str) -> set[str]:
        """Direct dependents."""
        return set(self._dependents.get(task_id, set()))

    def invalidate_cascade(self, changed_task_id: str) -> list[str]:
        """Return the transitive closure of dependents that must be re-done."""
        seen: set[str] = set()
        frontier = [changed_task_id]
        while frontier:
            node = frontier.pop()
            for dep in self.dependents_of(node):
                if dep not in seen:
                    seen.add(dep)
                    frontier.append(dep)
        return sorted(seen)

    def ready_tasks(self) -> list[Task]:
        """Tasks whose dependencies are all done (topological front)."""
        out = []
        for t in self._tasks.values():
            if t.status.value in ("done", "skipped"):
                continue
            deps = [self._tasks[d] for d in t.depends_on if d in self._tasks]
            if all(d.status.value in ("done", "skipped") for d in deps):
                out.append(t)
        return sorted(out, key=lambda t: t.id)

    def cycle_check(self) -> list[str]:
        """Detect cycles; returns a cycle path if one exists, else []."""
        WHITE, GRAY, BLACK = 0, 1, 2
        color: dict[str, int] = {k: WHITE for k in self._tasks}
        path: list[str] = []

        def dfs(n: str) -> list[str]:
            color[n] = GRAY
            path.append(n)
            for m in sorted(self._dependents.get(n, set())):
                if color[m] == GRAY:
                    return path[path.index(m):] + [m]
                if color[m] == WHITE:
                    cycle = dfs(m)
                    if cycle:
                        return cycle
            path.pop()
            color[n] = BLACK
            return []

        for n in sorted(self._tasks):
            if color[n] == WHITE:
                cycle = dfs(n)
                if cycle:
                    return cycle
        return []
