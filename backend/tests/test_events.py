"""Event bus: typed events, subscriber isolation, SSE fan-out."""
import asyncio

from app.domain.events import DomainEvent, EventBus, ev


def test_event_is_typed():
    e = ev("plan.version_created", "p1", version=2)
    assert isinstance(e, DomainEvent)
    assert e.type == "plan.version_created"
    assert e.project_id == "p1"
    assert e.payload == {"version": 2}


def test_bus_fans_out_to_subscribers():
    seen = []
    b = EventBus()
    b.subscribe(lambda e: seen.append(e.type))
    b.publish(ev("a.b"))
    b.publish(ev("c.d"))
    assert seen == ["a.b", "c.d"]


def test_broken_subscriber_does_not_break_bus():
    seen = []

    def broken(e):
        raise RuntimeError("boom")

    b = EventBus()
    b.subscribe(broken)
    b.subscribe(lambda e: seen.append(e.type))
    b.publish(ev("x.y"))
    assert seen == ["x.y"]


def test_stream_receives_events():
    async def scenario():
        b = EventBus()
        q = b.stream()
        b.publish(ev("sse.test", "p9", n=1))
        got = await q.get()
        b.unstream(q)
        return got

    event = asyncio.run(scenario())
    assert event.type == "sse.test"
