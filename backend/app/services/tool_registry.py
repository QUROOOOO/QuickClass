"""Tool registry — real, honest connection state for each supported tool.

No fake "connected" tools. A tool is only ever marked CONNECTED after a
real local capability check passes (binary present, filesystem writable,
subprocess runnable). Tools that genuinely need external credentials
(GitHub, Database, Deployment, generic external APIs) are honestly
reported as REQUIRES_AUTH until real credentials are wired — this
implementation does not fabricate a working integration for those.
"""
from __future__ import annotations

import os
import shutil
import subprocess
import tempfile
import time

from app.domain.tools import (
    PermissionRisk,
    ToolAuditEvent,
    ToolConnection,
    ToolDescriptor,
    ToolPermissionDef,
    ToolStatus,
    ToolType,
)
from app.persistence.store import Store


def _p(name: str, risk: PermissionRisk, desc: str = "") -> ToolPermissionDef:
    return ToolPermissionDef(name=name, risk=risk, description=desc)


# ---- static tool catalogue --------------------------------------------
# Building the full integration for every tool type is explicitly out of
# scope for this pass (spec: "do not implement every provider
# immediately") — this catalogue is the abstraction layer new tools slot
# into without touching the gateway or agent code.
CATALOGUE: dict[str, ToolDescriptor] = {
    "filesystem": ToolDescriptor(
        id="filesystem",
        name="Filesystem",
        description="Read and write files inside the project workspace sandbox.",
        type=ToolType.FILESYSTEM,
        capabilities=["read_file", "write_file", "list_directory"],
        permissions=[
            _p("filesystem.read", PermissionRisk.LOW, "Read files in the workspace."),
            _p("filesystem.write", PermissionRisk.MEDIUM, "Create or modify files in the workspace."),
        ],
    ),
    "git": ToolDescriptor(
        id="git",
        name="Git",
        description="Inspect and modify the local git history of a project.",
        type=ToolType.GIT,
        capabilities=["status", "diff", "commit", "branch"],
        permissions=[
            _p("git.read", PermissionRisk.LOW, "Read commit history and diffs."),
            _p("git.write", PermissionRisk.MEDIUM, "Create commits and branches."),
        ],
    ),
    "terminal": ToolDescriptor(
        id="terminal",
        name="Terminal",
        description="Execute shell commands in the sandboxed workspace.",
        type=ToolType.TERMINAL,
        capabilities=["execute"],
        permissions=[_p("terminal.execute", PermissionRisk.HIGH, "Run arbitrary shell commands.")],
    ),
    "github": ToolDescriptor(
        id="github",
        name="GitHub",
        description="Read repositories, open PRs, and manage issues on GitHub.",
        type=ToolType.GITHUB,
        capabilities=["read_repo", "open_pr", "manage_issues"],
        permissions=[
            _p("github.read", PermissionRisk.LOW, "Read repository data."),
            _p("github.write", PermissionRisk.HIGH, "Open PRs, push branches, manage issues."),
        ],
    ),
    "database": ToolDescriptor(
        id="database",
        name="Database",
        description="Query and migrate a connected project database.",
        type=ToolType.DATABASE,
        capabilities=["query", "migrate"],
        permissions=[
            _p("database.read", PermissionRisk.MEDIUM, "Run read-only queries."),
            _p("database.write", PermissionRisk.CRITICAL, "Run migrations or destructive writes."),
        ],
    ),
    "deployment": ToolDescriptor(
        id="deployment",
        name="Deployment",
        description="Trigger deployments to a configured hosting target.",
        type=ToolType.DEPLOYMENT,
        capabilities=["trigger_deploy", "rollback"],
        permissions=[_p("deployment.trigger", PermissionRisk.CRITICAL, "Deploy to a live environment.")],
    ),
    "browser": ToolDescriptor(
        id="browser",
        name="Browser",
        description="Drive a real browser to verify UI behavior (Playwright/MCP).",
        type=ToolType.BROWSER,
        capabilities=["navigate", "click", "screenshot", "inspect_dom"],
        permissions=[_p("browser.control", PermissionRisk.MEDIUM, "Control a browser session.")],
    ),
    "mcp": ToolDescriptor(
        id="mcp",
        name="MCP Server",
        description="Generic Model Context Protocol server connection.",
        type=ToolType.MCP,
        capabilities=[],
        permissions=[_p("mcp.invoke", PermissionRisk.MEDIUM, "Invoke tools exposed by the MCP server.")],
    ),
}


def _health_filesystem() -> tuple[bool, str]:
    try:
        d = tempfile.mkdtemp(prefix="cb_fs_probe_")
        p = os.path.join(d, "probe.txt")
        with open(p, "w") as f:
            f.write("ok")
        ok = open(p).read() == "ok"
        shutil.rmtree(d, ignore_errors=True)
        return ok, "" if ok else "probe file mismatch"
    except OSError as e:
        return False, str(e)


def _health_git() -> tuple[bool, str]:
    path = shutil.which("git")
    if not path:
        return False, "git binary not found on PATH"
    try:
        r = subprocess.run(["git", "--version"], capture_output=True, timeout=3, text=True)
        return r.returncode == 0, r.stderr.strip() if r.returncode != 0 else ""
    except (OSError, subprocess.SubprocessError) as e:
        return False, str(e)


def _health_terminal() -> tuple[bool, str]:
    try:
        r = subprocess.run(["echo", "ok"], capture_output=True, timeout=3, text=True)
        return r.stdout.strip() == "ok", "" if r.stdout.strip() == "ok" else "unexpected output"
    except (OSError, subprocess.SubprocessError) as e:
        return False, str(e)


# tools that only need a local capability check — no external credentials
_LOCAL_HEALTH_CHECKS = {
    "filesystem": _health_filesystem,
    "git": _health_git,
    "terminal": _health_terminal,
}
# tools that genuinely require external credentials this build does not
# yet collect — honestly reported, never faked as connected
_REQUIRES_AUTH = {"github", "database", "deployment", "browser", "mcp"}


class ToolRegistry:
    def __init__(self, store: Store) -> None:
        self.store = store

    def descriptors(self) -> list[ToolDescriptor]:
        return list(CATALOGUE.values())

    def descriptor(self, tool_id: str) -> ToolDescriptor | None:
        return CATALOGUE.get(tool_id)

    def connection(self, tool_id: str) -> ToolConnection:
        data = self.store.get("tool_connections", tool_id)
        if data:
            return ToolConnection(**data)
        if tool_id in _LOCAL_HEALTH_CHECKS:
            # tools with a real, always-available local capability connect
            # on first access rather than defaulting to a misleading
            # "disconnected" — still a genuine check, not a fabricated status
            return self._connect_fresh(tool_id, enable=True)
        return ToolConnection(tool_id=tool_id)

    def _connect_fresh(self, tool_id: str, enable: bool = False) -> ToolConnection:
        conn = ToolConnection(tool_id=tool_id)
        ok, err = _LOCAL_HEALTH_CHECKS[tool_id]()
        conn.status = ToolStatus.CONNECTED if ok else ToolStatus.ERROR
        conn.connected_at = time.time() if ok else None
        conn.error = err
        conn.enabled = ok and enable
        self._audit(tool_id, "connect", "ok" if ok else "error", err)
        return self._save(conn)

    def _save(self, conn: ToolConnection) -> ToolConnection:
        conn.updated_at = time.time()
        self.store.put("tool_connections", conn.tool_id, conn.model_dump(mode="json"))
        return conn

    def _audit(self, tool_id: str, action: str, result: str, detail: str = "", risk: str | None = None) -> None:
        ev = ToolAuditEvent(tool_id=tool_id, action=action, result=result, detail=detail, risk=risk)
        self.store.put("tool_audit", ev.id, ev.model_dump(mode="json"))

    def audit(self, tool_id: str) -> list[dict]:
        return [d for d in self.store.list("tool_audit") if d.get("tool_id") == tool_id]

    def health_check(self, tool_id: str) -> ToolConnection:
        if tool_id not in CATALOGUE:
            raise KeyError(tool_id)
        conn = self.connection(tool_id)
        start = time.perf_counter()
        if tool_id in _LOCAL_HEALTH_CHECKS:
            ok, err = _LOCAL_HEALTH_CHECKS[tool_id]()
        elif tool_id in _REQUIRES_AUTH:
            ok, err = False, "no credentials configured for this tool"
        else:
            ok, err = False, "unknown tool"
        latency_ms = (time.perf_counter() - start) * 1000
        conn.last_health_check = time.time()
        conn.last_latency_ms = round(latency_ms, 2)
        conn.error = err
        if not ok and tool_id in _REQUIRES_AUTH:
            conn.status = ToolStatus.REQUIRES_AUTH
        elif not ok:
            conn.status = ToolStatus.ERROR
        # else: leave status as-is (a passing health check alone doesn't connect it)
        self._audit(tool_id, "test", "ok" if ok else "error", err)
        return self._save(conn)

    def connect(self, tool_id: str) -> ToolConnection:
        if tool_id not in CATALOGUE:
            raise KeyError(tool_id)
        if tool_id in _REQUIRES_AUTH:
            conn = ToolConnection(tool_id=tool_id)
            conn.status = ToolStatus.REQUIRES_AUTH
            conn.error = "connect requires credentials that are not yet configured for this tool"
            self._audit(tool_id, "connect", "error", conn.error)
            return self._save(conn)
        return self._connect_fresh(tool_id, enable=True)

    def disconnect(self, tool_id: str) -> ToolConnection:
        conn = self.connection(tool_id)
        conn.status = ToolStatus.DISCONNECTED
        conn.enabled = False
        conn.connected_at = None
        self._audit(tool_id, "disconnect", "ok")
        return self._save(conn)

    def set_enabled(self, tool_id: str, enabled: bool) -> ToolConnection:
        conn = self.connection(tool_id)
        if enabled and conn.status != ToolStatus.CONNECTED:
            raise ValueError("cannot enable a tool that is not connected")
        conn.enabled = enabled
        self._audit(tool_id, "enable" if enabled else "disable", "ok")
        return self._save(conn)

    def mark_used(self, tool_id: str) -> None:
        conn = self.connection(tool_id)
        conn.last_used = time.time()
        self._save(conn)
