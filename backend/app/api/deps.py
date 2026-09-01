"""Request wiring — store, services, and runtime per request."""
from __future__ import annotations

from functools import lru_cache

from app.agents.adk_agents import AgentRuntime, create_runtime
from app.config import get_settings
from app.persistence.store import Store, create_store
from app.services.credentials import CredentialService, credential_service
from app.services.plan_service import PlanService
from app.services.project_service import ProjectService
from app.services.usage import UsageService


@lru_cache
def store() -> Store:
    s = get_settings()
    return create_store(
        backend=s.store_backend,
        file_path=s.store_file,
        project_id=s.firebase_project_id,
        credentials=s.firebase_credentials,
    )


@lru_cache
def runtime() -> AgentRuntime:
    return create_runtime()


@lru_cache
def projects() -> ProjectService:
    return ProjectService(store=store(), plans=plans(), executor=runtime(), usage=usage())


@lru_cache
def plans() -> PlanService:
    return PlanService()


@lru_cache
def usage() -> UsageService:
    return UsageService(store())


def credentials() -> CredentialService:
    return credential_service
