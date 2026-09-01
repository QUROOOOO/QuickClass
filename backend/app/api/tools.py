"""Connected Tools API — real connection state, real health checks."""
from __future__ import annotations

from fastapi import APIRouter, Depends

from app.api.deps import projects as projects_service
from app.errors import NotFound, ToolNotAvailable
from app.security import current_user, require_auth

router = APIRouter(prefix="/tools", tags=["tools"])


def _registry():
    return projects_service().tool_gateway.registry


def _serialize(tool_id: str) -> dict:
    reg = _registry()
    d = reg.descriptor(tool_id)
    c = reg.connection(tool_id)
    return {**d.model_dump(mode="json"), "connection": c.model_dump(mode="json")}


@router.get("")
def list_tools(user: dict = Depends(current_user)):
    reg = _registry()
    return [_serialize(d.id) for d in reg.descriptors()]


@router.get("/{tool_id}")
def get_tool(tool_id: str, user: dict = Depends(current_user)):
    if _registry().descriptor(tool_id) is None:
        raise NotFound("tool", tool_id)
    return _serialize(tool_id)


@router.post("/{tool_id}/connect")
def connect_tool(tool_id: str, user: dict = Depends(require_auth)):
    if _registry().descriptor(tool_id) is None:
        raise NotFound("tool", tool_id)
    _registry().connect(tool_id)
    return _serialize(tool_id)


@router.post("/{tool_id}/disconnect")
def disconnect_tool(tool_id: str, user: dict = Depends(require_auth)):
    if _registry().descriptor(tool_id) is None:
        raise NotFound("tool", tool_id)
    _registry().disconnect(tool_id)
    return _serialize(tool_id)


@router.post("/{tool_id}/enable")
def enable_tool(tool_id: str, user: dict = Depends(require_auth)):
    if _registry().descriptor(tool_id) is None:
        raise NotFound("tool", tool_id)
    try:
        _registry().set_enabled(tool_id, True)
    except ValueError as e:
        raise ToolNotAvailable(tool_id, tool_id, str(e)) from e
    return _serialize(tool_id)


@router.post("/{tool_id}/disable")
def disable_tool(tool_id: str, user: dict = Depends(require_auth)):
    if _registry().descriptor(tool_id) is None:
        raise NotFound("tool", tool_id)
    _registry().set_enabled(tool_id, False)
    return _serialize(tool_id)


@router.post("/{tool_id}/test")
def test_tool(tool_id: str, user: dict = Depends(require_auth)):
    if _registry().descriptor(tool_id) is None:
        raise NotFound("tool", tool_id)
    _registry().health_check(tool_id)
    return _serialize(tool_id)


@router.get("/{tool_id}/audit")
def tool_audit(tool_id: str, user: dict = Depends(current_user)):
    if _registry().descriptor(tool_id) is None:
        raise NotFound("tool", tool_id)
    return _registry().audit(tool_id)
