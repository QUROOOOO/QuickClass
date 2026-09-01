"""Typed event stream — SSE from the event bus."""
from __future__ import annotations

import asyncio
import json

from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.domain.events import bus

router = APIRouter(prefix="/events", tags=["events"])


class EventFilter(BaseModel):
    project_id: str | None = None
    types: list[str] | None = None


@router.post("/stream")
async def stream_events(filter: EventFilter | None = None, request: Request = None):
    queue = bus.stream()

    async def generator():
        try:
            while True:
                if await request.is_disconnected():
                    break
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=15)
                except asyncio.TimeoutError:
                    yield ": keep-alive\n\n"
                    continue
                if filter and filter.project_id and event.project_id != filter.project_id:
                    continue
                if filter and filter.types and event.type not in filter.types:
                    continue
                yield f"event: {event.type}\ndata: {json.dumps(event.model_dump())}\n\n"
        finally:
            bus.unstream(queue)

    return StreamingResponse(generator(), media_type="text/event-stream")
