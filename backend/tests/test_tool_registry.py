"""Connected Tools: real health checks, honest connection state, gateway enforcement."""
import pytest

from app.domain.tools import ToolStatus
from app.errors import ToolNotAvailable
from app.persistence.store import InMemoryStore
from app.services.tool_gateway import ToolGateway
from app.services.tool_registry import ToolRegistry


def test_filesystem_connects_via_real_local_check():
    reg = ToolRegistry(InMemoryStore())
    conn = reg.connection("filesystem")
    assert conn.status == ToolStatus.CONNECTED  # a real temp-file write/read actually happened
    assert conn.enabled is True


def test_terminal_connects_via_real_subprocess_check():
    reg = ToolRegistry(InMemoryStore())
    conn = reg.connection("terminal")
    assert conn.status == ToolStatus.CONNECTED


def test_github_honestly_requires_auth_not_faked_connected():
    reg = ToolRegistry(InMemoryStore())
    conn = reg.connect("github")
    assert conn.status == ToolStatus.REQUIRES_AUTH
    assert "credentials" in conn.error


def test_disconnect_then_disable_state():
    reg = ToolRegistry(InMemoryStore())
    reg.connection("filesystem")  # auto-connects
    conn = reg.disconnect("filesystem")
    assert conn.status == ToolStatus.DISCONNECTED
    assert conn.enabled is False


def test_cannot_enable_a_disconnected_tool():
    reg = ToolRegistry(InMemoryStore())
    reg.disconnect("filesystem")
    with pytest.raises(ValueError):
        reg.set_enabled("filesystem", True)


def test_health_check_reports_real_latency_and_result():
    reg = ToolRegistry(InMemoryStore())
    conn = reg.health_check("filesystem")
    assert conn.last_latency_ms is not None and conn.last_latency_ms >= 0
    assert conn.last_health_check is not None


def test_audit_trail_records_actions():
    reg = ToolRegistry(InMemoryStore())
    reg.connection("filesystem")
    reg.disconnect("filesystem")
    reg.connect("filesystem")
    events = reg.audit("filesystem")
    actions = [e["action"] for e in events]
    assert "disconnect" in actions and "connect" in actions


def test_gateway_authorizes_connected_tool():
    reg = ToolRegistry(InMemoryStore())
    gw = ToolGateway(reg)
    gw.authorize("fs.write")  # filesystem auto-connects — must not raise


def test_gateway_blocks_disconnected_tool():
    reg = ToolRegistry(InMemoryStore())
    reg.disconnect("filesystem")
    gw = ToolGateway(reg)
    with pytest.raises(ToolNotAvailable):
        gw.authorize("fs.write")


def test_gateway_blocks_disabled_tool():
    reg = ToolRegistry(InMemoryStore())
    reg.connection("filesystem")
    reg.set_enabled("filesystem", False)
    gw = ToolGateway(reg)
    with pytest.raises(ToolNotAvailable):
        gw.authorize("fs.write")


def test_gateway_passes_through_unmapped_tools():
    reg = ToolRegistry(InMemoryStore())
    gw = ToolGateway(reg)
    gw.authorize("deploy.publish")  # governed by the existing approval flow, not this gateway


def test_gateway_used_via_execution_records_last_used():
    reg = ToolRegistry(InMemoryStore())
    gw = ToolGateway(reg)
    gw.authorize("fs.write")
    conn = reg.connection("filesystem")
    assert conn.last_used is not None
