# Code Butler — backend

The planning engine behind the calm builder. FastAPI + Pydantic + Google ADK.

## Run

```bash
pip install -e ".[test,agents]"
uvicorn app.main:app --port 8000      # http://127.0.0.1:8000/docs
```

## Configuration (all env, prefix `CB_`)

| Env                          | Default             | Meaning                                   |
|------------------------------|---------------------|-------------------------------------------|
| `CB_STORE_BACKEND`           | `memory`            | `memory` \| `file` \| `firestore`         |
| `CB_STORE_FILE`              | `data/store.jsonl`  | JSONL path when backend is `file`         |
| `CB_FIREBASE_PROJECT_ID`     | —                   | enables Firebase Admin auth + Firestore   |
| `CB_FIREBASE_CREDENTIALS`    | —                   | service-account JSON path                 |
| `CB_AGENT_MODEL`             | —                   | ADK model id (e.g. `gemini-2.5-flash`)    |
| `CB_AGENT_MODEL_KEY`         | `GEMINI_API_KEY`    | env var name holding the API key          |
| `CB_RATE_LIMIT_PER_MINUTE`   | `120`               | per-client request budget                 |
| `CB_MAX_TOOL_RETRIES`        | `3`                 | retries after the first tool attempt      |

Without `CB_AGENT_MODEL` the app runs in honest plan-only mode: executions
complete with a recorded note and no fake AI output. Set the model + key to
run the real ADK agents (Master Orchestrator / Planner / Executor).

## Architecture

- `app/domain/` — models, state machine, dependency graph, plan versioning, typed events
- `app/persistence/` — Firestore-compatible `Store` (memory / file / Firestore)
- `app/services/` — plan service, project orchestration, tool policy, verification
- `app/agents/` — Google ADK agents behind an `AgentRuntime` protocol
- `app/api/` — routes; `app/api/events.py` is the SSE stream

## Critical flow

goal → planning → plan v1 → tech edits (each = new version + cascade
invalidation) → submit → awaiting_review → approve → executing → verify
(evidence-backed) → completed. Risky tool calls pause for human approval;
denied tools never run; failures are typed and recoverable.

## Tests

```bash
python -m pytest          # 41 tests: state, graph, plans, events, tools,
                          # approvals, verification, security, full API path
```
