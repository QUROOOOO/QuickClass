"""Google ADK agents — Master Orchestrator, Planner, Executor.

The model is pluggable via env (CB_AGENT_MODEL + CB_AGENT_MODEL_KEY):
  - a key configured → real ADK agents run
  - no key           → the app stays fully functional with an honest
    recorded runtime (plan-only mode); nothing pretends a model ran.

Orchestration never hard-depends on a model: it talks to the
AgentRuntime protocol, so tests exercise the whole pipeline without
network or keys.
"""
from __future__ import annotations

import json
import os
import re
from dataclasses import dataclass, field

from app.domain.models import AgentRun, Task, ToolCall


@dataclass
class AgentRunResult:
    summary: str
    tool_calls: list[ToolCall] = field(default_factory=list)
    # real usage when the runtime reports it (0 = unknown; caller estimates)
    input_tokens: int = 0
    output_tokens: int = 0


class AgentRuntime:
    """What orchestration needs from an agent. Testable without ADK."""

    name = "base"

    def run(self, run: AgentRun, task: Task) -> AgentRunResult:
        raise NotImplementedError


# ---------------------------------------------------------------------------
# Real ADK runtime (needs a model + key)
# ---------------------------------------------------------------------------

PLANNER_INSTRUCTION = """You are the Planner of Code Butler. Given a goal, produce a
concrete implementation plan: requirements, architecture decisions, tech
decisions, milestones, and ordered tasks with dependencies. Output compact
JSON with keys: requirements, architecture, technology, milestones, tasks
(each task: title, description, depends_on[], agent, milestone). Be honest:
no invented services, no fake approvals."""

EXECUTOR_INSTRUCTION = """You are the Executor of Code Butler. Given one task, decide the
tool calls needed: fs.write, fs.read, tests.run, deploy.publish. Output
compact JSON: {"summary": "...", "tool_calls": [{"tool": "...", "args": {...}}]}.
Tools with risk (deploy.publish) pause for human approval — never pretend
they ran."""

MASTER_INSTRUCTION = """You are the Master Orchestrator of Code Butler. You coordinate
the Planner and Executor sub-agents, keep the human informed in calm, plain
language, and never claim work is done without evidence."""


def _build_adk_agents(model: str, api_key: str):
    from google.adk import Agent

    try:
        from google.adk.models.google_models import GeminiModel

        if api_key:
            model = GeminiModel(model=model, api_key=api_key)
    except Exception:
        pass  # fall back to string model id

    planner = Agent(
        name="planner",
        description="Turns a goal into a versioned implementation plan.",
        instruction=PLANNER_INSTRUCTION,
        model=model,
    )
    executor = Agent(
        name="executor",
        description="Executes one task with policy-checked tool calls.",
        instruction=EXECUTOR_INSTRUCTION,
        model=model,
        tools=[spec.run for spec in __import__(
            "app.services.tools", fromlist=["TOOL_REGISTRY"]
        ).TOOL_REGISTRY.values()],
    )
    master = Agent(
        name="master",
        description="Orchestrates planning and execution for Code Butler.",
        instruction=MASTER_INSTRUCTION,
        model=model,
        sub_agents=[planner, executor],
    )
    return master


def _parse_agent_output(text: str) -> dict:
    """Extract the JSON payload from an agent reply (handles code fences)."""
    if not text:
        return {}
    cleaned = re.sub(r"```(?:json)?", "", text).strip("` \n")
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", cleaned, re.DOTALL)
        if not match:
            return {"summary": cleaned[:200]}
        try:
            return json.loads(match.group(0))
        except json.JSONDecodeError:
            return {"summary": cleaned[:200]}


class AdkRuntime(AgentRuntime):
    """Runs ADK agents. Constructing this without a key raises Unconfigured."""

    name = "adk"

    def __init__(self, model: str, api_key: str) -> None:
        if not model:
            from app.errors import Unconfigured

            raise Unconfigured("ADK agent model (CB_AGENT_MODEL)")
        self.model = model
        self.api_key = api_key
        self.master = _build_adk_agents(model, api_key)
        from google.adk.artifacts import InMemoryArtifactService
        from google.adk.runners import Runner
        from google.adk.sessions import InMemorySessionService

        self._sessions = InMemorySessionService()
        self._artifacts = InMemoryArtifactService()
        self._runner = Runner(
            app_name="code-butler",
            agent=self.master,
            session_service=self._sessions,
            artifact_service=self._artifacts,
        )

    def run(self, run: AgentRun, task: Task) -> AgentRunResult:
        from google.adk import content

        result = self._runner.run(
            user_id=run.id,
            session_id=f"session_{run.id}",
            new_message=content.Content(text=f"Task: {task.title}\n{task.description}"),
        )
        summary = ""
        tool_calls: list[ToolCall] = []
        for part in getattr(result, "message", []).parts:
            text = getattr(part, "text", "") or ""
            parsed = _parse_agent_output(text)
            if "summary" in parsed:
                summary = parsed["summary"]
            for call in parsed.get("tool_calls", []):
                tool_calls.append(
                    ToolCall(
                        project_id=run.project_id,
                        run_id=run.id,
                        tool=call.get("tool", "fs.write"),
                        args=call.get("args", {}),
                    )
                )
        return AgentRunResult(summary=summary or task.title, tool_calls=tool_calls)


# ---------------------------------------------------------------------------
# Honest fallback runtime (no model configured) — tests + plan-only mode
# ---------------------------------------------------------------------------

class RecordedRuntime(AgentRuntime):
    """No model behind it — records the run and yields no tool calls.

    Used when CB_AGENT_MODEL is unset. Executions complete with the
    explicit note that they ran in plan-only mode; nothing fakes AI output.
    """

    name = "recorded"

    def run(self, run: AgentRun, task: Task) -> AgentRunResult:
        return AgentRunResult(summary=f"(plan-only) {task.title}")


# ---------------------------------------------------------------------------
# factory
# ---------------------------------------------------------------------------

def create_runtime() -> AgentRuntime:
    from app.config import get_settings

    settings = get_settings()
    if not settings.agent_model:
        return RecordedRuntime()
    key_env = settings.agent_model_key or "GEMINI_API_KEY"
    api_key = os.environ.get(key_env, "")
    return AdkRuntime(settings.agent_model, api_key)
