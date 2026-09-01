"""Tool Gateway — the authoritative checkpoint between an agent and a tool.

Flow: Agent -> Tool Gateway -> Permission Check -> Tool -> Result -> Agent.
The agent never calls a tool directly; this gateway is what decides
whether the underlying tool is actually connected and enabled before
`execute_tool_call` runs. High-risk/EXTERNAL tools continue to be
governed by the pre-existing approval flow in services/tools.py — this
gateway currently gates the local-capability tools (filesystem, terminal)
where a real connection state exists to check. Extending the same
`authorize()` call to EXTERNAL/CRITICAL tools is the natural next step
once those integrations collect real credentials.
"""
from __future__ import annotations

from app.domain.tools import ToolStatus
from app.errors import ToolNotAvailable
from app.services.tool_registry import ToolRegistry

# low-level tool-call name -> Connected Tools registry id
TOOL_MAP: dict[str, str] = {
    "fs.write": "filesystem",
    "fs.read": "filesystem",
    "tests.run": "terminal",
}


class ToolGateway:
    def __init__(self, registry: ToolRegistry) -> None:
        self.registry = registry

    def authorize(self, tool_name: str) -> None:
        tool_id = TOOL_MAP.get(tool_name)
        if tool_id is None:
            return  # not yet mapped into the gateway (e.g. deploy.publish)
        conn = self.registry.connection(tool_id)
        if conn.status != ToolStatus.CONNECTED or not conn.enabled:
            raise ToolNotAvailable(tool_name, tool_id, conn.status.value)
        self.registry.mark_used(tool_id)
