"""Structured errors — every failure leaves an honest, typed trace."""
from __future__ import annotations

from fastapi import HTTPException
from pydantic import BaseModel, Field


class ErrorDetail(BaseModel):
    code: str = Field(description="Stable machine-readable code")
    message: str
    details: dict = Field(default_factory=dict)


class ApiError(Exception):
    """Raised by services; converted to a structured HTTP error by handlers."""

    def __init__(self, status: int, code: str, message: str, **details):
        super().__init__(message)
        self.status = status
        self.code = code
        self.message = message
        self.details = details

    def to_http(self) -> HTTPException:
        return HTTPException(
            status_code=self.status,
            detail=ErrorDetail(code=self.code, message=self.message, details=self.details).model_dump(),
        )


class NotFound(ApiError):
    def __init__(self, what: str, id: str):
        super().__init__(404, "not_found", f"{what} '{id}' was not found.", resource=what, id=id)


class Conflict(ApiError):
    def __init__(self, message: str, **details):
        super().__init__(409, "conflict", message, **details)


class InvalidInput(ApiError):
    def __init__(self, message: str, **details):
        super().__init__(422, "invalid_input", message, **details)


class Forbidden(ApiError):
    def __init__(self, message: str = "You don't have access to this resource.", **details):
        super().__init__(403, "forbidden", message, **details)


class ApprovalRequired(ApiError):
    def __init__(self, message: str, approval_id: str, **details):
        super().__init__(202, "approval_required", message, approval_id=approval_id, **details)


class Unconfigured(ApiError):
    def __init__(self, what: str):
        super().__init__(503, "unconfigured", f"{what} is not configured.", resource=what)


class BudgetPaused(ApiError):
    """The run is paused, not terminated — work is preserved and resumable."""

    def __init__(self, message: str, pause_id: str, **details):
        super().__init__(202, "budget_paused", message, pause_id=pause_id, **details)


class ToolNotAvailable(ApiError):
    """The Tool Gateway rejected a call — the underlying tool is not
    connected/enabled. The agent never bypasses this check."""

    def __init__(self, tool: str, tool_id: str, connection_status: str):
        super().__init__(
            409,
            "tool_not_available",
            f"Tool '{tool}' is unavailable ({tool_id}: {connection_status}).",
            tool=tool,
            tool_id=tool_id,
            connection_status=connection_status,
        )
