"""Agent runtime: real ADK wired, fallback honest — pipeline works without keys."""
from app.agents.adk_agents import RecordedRuntime
from app.domain.models import AgentRun, Task


def test_recorded_runtime_is_honest():
    run = AgentRun(project_id="p1", execution_id="e1", role="executor", task_id="t1")
    task = Task(id="t1", project_id="p1", title="Write landing page")
    result = RecordedRuntime().run(run, task)
    assert result.summary.startswith("(plan-only)")
    assert result.tool_calls == []


def test_parse_agent_output_handles_fences():
    from app.agents.adk_agents import _parse_agent_output

    text = '```json\n{"summary": "done", "tool_calls": [{"tool": "fs.write", "args": {"path": "a"}}]}\n```'
    parsed = _parse_agent_output(text)
    assert parsed["summary"] == "done"
    assert parsed["tool_calls"][0]["tool"] == "fs.write"


def test_parse_agent_output_bare_json():
    from app.agents.adk_agents import _parse_agent_output

    assert _parse_agent_output('{"summary": "ok"}')["summary"] == "ok"
    assert _parse_agent_output("just words")["summary"] == "just words"
