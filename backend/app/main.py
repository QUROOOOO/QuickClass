"""Code Butler API — the planning engine behind the calm builder."""
from __future__ import annotations

import time

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api import auth, events, executions, plans, projects, settings as settings_api, tools as tools_api
from app.config import get_settings
from app.domain.events import wire_audit_log
from app.errors import ApiError, ErrorDetail

settings = get_settings()

app = FastAPI(title=settings.app_name, version="0.1.0", docs_url="/docs", openapi_url="/openapi.json")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.state.users = []  # demo user store — replaced by Firebase Auth when configured

app.include_router(auth.router, prefix=settings.api_prefix)
app.include_router(projects.router, prefix=settings.api_prefix)
app.include_router(plans.router, prefix=settings.api_prefix)
app.include_router(executions.router, prefix=settings.api_prefix)
app.include_router(events.router, prefix=settings.api_prefix)
app.include_router(settings_api.router, prefix=settings.api_prefix)
app.include_router(tools_api.router, prefix=settings.api_prefix)

wire_audit_log("data/audit.jsonl" if settings.store_backend == "file" else None)


@app.exception_handler(ApiError)
async def api_error_handler(request: Request, exc: ApiError):
    return JSONResponse(status_code=exc.status, content=ErrorDetail(**exc.__dict__).model_dump())


@app.middleware("http")
async def timing_middleware(request: Request, call_next):
    start = time.perf_counter()
    response = await call_next(request)
    response.headers["X-Request-Time-Ms"] = f"{(time.perf_counter() - start) * 1000:.1f}"
    return response


@app.get("/health")
def health():
    return {"ok": True, "app": settings.app_name, "env": settings.env, "time": time.time()}
