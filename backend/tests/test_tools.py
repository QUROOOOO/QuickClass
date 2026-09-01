"""Tool policy: read/write run, risky tools pause for approval, retries bounded."""
import pytest

from app.domain.models import ToolCall, ToolPermission
from app.errors import ApprovalRequired
from app.services.tools import execute_tool_call


def test_read_tool_allowed(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    call = ToolCall(project_id="p1", run_id="r1", tool="fs.write", args={"path": "a.txt", "content": "hi"})
    out = execute_tool_call(call, "p1")
    assert out.status == "succeeded"
    assert out.permission == ToolPermission.ALLOW


def test_publish_requires_approval():
    call = ToolCall(project_id="p1", run_id="r1", tool="deploy.publish", args={})
    with pytest.raises(ApprovalRequired):
        execute_tool_call(call, "p1")
    assert call.status == "pending"


def test_unknown_tool_rejected():
    call = ToolCall(project_id="p1", run_id="r1", tool="nope.nope", args={})
    from app.errors import InvalidInput

    with pytest.raises(InvalidInput):
        execute_tool_call(call, "p1")


def test_retries_bounded_on_failure(monkeypatch):
    from app.services import tools

    def flaky(project_id, **args):
        raise RuntimeError("always fails")

    tools.TOOL_REGISTRY["tests.run"].run = flaky
    call = ToolCall(project_id="p1", run_id="r1", tool="tests.run", args={})
    out = execute_tool_call(call, "p1")
    assert out.status == "failed"
    assert out.retries == 3  # max_tool_retries
