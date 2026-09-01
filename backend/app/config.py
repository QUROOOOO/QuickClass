"""Environment configuration — everything is overridable, nothing hard-coded."""
from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="CB_", env_file=".env", extra="ignore")

    app_name: str = "Code Butler API"
    api_prefix: str = "/api/v1"
    env: str = "development"

    # persistence: "memory" | "file" | "firestore"
    store_backend: str = "memory"
    store_file: str = "data/store.jsonl"

    # auth — Firebase Admin when a credential is present, otherwise a local demo
    firebase_project_id: str = ""
    firebase_credentials: str = ""  # path to service-account JSON
    auth_demo_enabled: bool = True

    # agent model — Google ADK / Gemini
    agent_model: str = ""
    agent_model_key: str = ""  # env var name holding the API key

    # rate limiting (requests per minute per client)
    rate_limit_per_minute: int = 120

    # bounded retries for tool calls
    max_tool_retries: int = 3

    # budget enforcement — used only when a runtime does not report real
    # token usage (e.g. the plan-only / recorded runtime); a real provider
    # gateway should report actual input/output tokens instead.
    budget_estimate_tokens_per_task: int = 400
    budget_estimate_cost_per_task: float = 0.01


@lru_cache
def get_settings() -> Settings:
    return Settings()
