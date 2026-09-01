"""Connected Tools domain — what the agent can actually use, and how it's governed.

This is deliberately separate from the low-level `ToolSpec` execution
registry in services/tools.py: that layer runs an individual tool CALL
during a task; this layer represents whether the underlying tool is
CONNECTED, ENABLED, and healthy enough to be called at all. The Tool
Gateway (services/tool_gateway.py) is the bridge: it checks connection
state here before `execute_tool_call` is allowed to run.
"""
from __future__ import annotations

from enum import StrEnum

from pydantic import BaseModel, Field

from app.domain.models import _id, _now


class ToolType(StrEnum):
    MCP = "mcp"
    BROWSER = "browser"
    FILESYSTEM = "filesystem"
    GIT = "git"
    GITHUB = "github"
    TERMINAL = "terminal"
    DATABASE = "database"
    DEPLOYMENT = "deployment"
    EXTERNAL_API = "external_api"


class ToolStatus(StrEnum):
    CONNECTED = "connected"
    DISCONNECTED = "disconnected"
    DISABLED = "disabled"
    ERROR = "error"
    REQUIRES_AUTH = "requires_authentication"


class PermissionRisk(StrEnum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class ToolPermissionDef(BaseModel):
    name: str  # e.g. "filesystem.write"
    risk: PermissionRisk
    description: str = ""


class ToolDescriptor(BaseModel):
    """Static definition of a tool the system knows how to support."""

    id: str
    name: str
    description: str
    type: ToolType
    capabilities: list[str] = Field(default_factory=list)
    permissions: list[ToolPermissionDef] = Field(default_factory=list)


class ToolConnection(BaseModel):
    """Mutable, persisted connection state for a tool."""

    tool_id: str
    status: ToolStatus = ToolStatus.DISCONNECTED
    enabled: bool = False
    connected_at: float | None = None
    last_health_check: float | None = None
    last_used: float | None = None
    last_latency_ms: float | None = None
    error: str = ""
    metadata: dict = Field(default_factory=dict)
    updated_at: float = Field(default_factory=_now)


class ToolAuditEvent(BaseModel):
    id: str = Field(default_factory=lambda: _id("toolaudit"))
    tool_id: str
    action: str  # connect | disconnect | enable | disable | test | invoke
    who: str = "system"
    result: str = ""  # ok | error
    risk: PermissionRisk | None = None
    approval_id: str | None = None
    detail: str = ""
    timestamp: float = Field(default_factory=_now)
