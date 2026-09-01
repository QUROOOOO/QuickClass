"""End-to-end API flow — the critical path of the product.

goal → plan → submit for review → approve → execute → verify → complete
"""
import time

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture
def client():
    app.state.users = []
    with TestClient(app) as c:
        yield c


def signup(client, email="ada@example.com", password="secret123"):
    r = client.post("/api/v1/auth/signup", json={"email": email, "password": password, "name": "Ada"})
    assert r.status_code == 200, r.text
    return r.json()["token"]


def auth(token):
    return {"Authorization": f"Bearer {token}"}


def test_health():
    with TestClient(app) as c:
        assert c.get("/health").json()["ok"] is True


def test_signup_signin_flow(client):
    token = signup(client)
    r = client.post("/api/v1/auth/signin", json={"email": "ada@example.com", "password": "secret123"})
    assert r.status_code == 200
    assert r.json()["user"]["name"] == "Ada"
    r = client.post("/api/v1/auth/signin", json={"email": "ada@example.com", "password": "wrong-pass"})
    assert r.status_code == 422
    r = client.post("/api/v1/auth/signout", headers=auth(token))
    assert r.json() == {"ok": True}


def test_project_requires_auth(client):
    assert client.get("/api/v1/projects").status_code == 403
    assert client.post("/api/v1/projects", json={"title": "x"}).status_code == 403


def test_full_critical_path(client):
    token = signup(client)
    h = auth(token)

    # create project
    r = client.post("/api/v1/projects", json={"title": "Gym app"}, headers=h)
    assert r.status_code == 200
    pid = r.json()["id"]

    # goal -> planning
    r = client.post(
        f"/api/v1/projects/{pid}/planning",
        json={"goal": "Build a members-only gym app", "context": "small studio"},
        headers=h,
    )
    assert r.status_code == 200
    assert r.json()["status"] == "planning"

    # seed plan v1 with a tech decision
    r = client.post(
        "/api/v1/plans",
        json={"project_id": pid, "goal": "Build a members-only gym app", "context": "small studio"},
        headers=h,
    )
    assert r.status_code == 200
    assert r.json()["version"] == 1

    # edit tech decision Supabase -> Firebase -> plan v2 + invalidation
    r = client.post(
        f"/api/v1/plans/{pid}/tech",
        json={"category": "DATABASE", "choice": "Firebase", "reason": "planning pass"},
        headers=h,
    )
    assert r.status_code == 200, r.text
    assert r.json()["version"] == 2
    assert r.json()["parent_version"] == 1
    assert [t["choice"] for t in r.json()["technology"] if t["status"] == "superseded"] == ["Supabase"]

    # history records the chain
    r = client.get(f"/api/v1/plans/{pid}/history", headers=h)
    assert [v["version"] for v in r.json()] == [1, 2]

    # submit -> awaiting_review
    r = client.post(f"/api/v1/projects/{pid}/submit", headers=h)
    assert r.json()["status"] == "awaiting_review"

    # approve -> approved
    r = client.post(f"/api/v1/projects/{pid}/review?decision=approve", headers=h)
    assert r.json()["status"] == "approved"

    # execute -> runs tasks (plan-only runtime), verification passes
    r = client.post(f"/api/v1/projects/{pid}/execute", headers=h)
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "succeeded"

    runs = client.get(f"/api/v1/executions/{pid}/runs", headers=h).json()
    assert len(runs) == 1  # v2 re-targeted the single seed task
    assert all(run["status"] == "succeeded" for run in runs)

    artifacts = client.get(f"/api/v1/executions/{pid}/artifacts", headers=h).json()
    assert len(artifacts) == 1

    # complete
    r = client.post(f"/api/v1/projects/{pid}/complete", headers=h)
    assert r.json()["status"] == "completed"


def test_rejected_plan_returns_to_planning(client):
    token = signup(client)
    h = auth(token)
    pid = client.post("/api/v1/projects", json={"title": "X"}, headers=h).json()["id"]
    client.post(
        f"/api/v1/projects/{pid}/planning",
        json={"goal": "A website for a bakery"},
        headers=h,
    )
    client.post("/api/v1/plans", json={"project_id": pid, "goal": "A website for a bakery"}, headers=h)
    client.post(f"/api/v1/plans/{pid}/tech", json={"category": "FRONTEND", "choice": "Next.js"}, headers=h)
    client.post(f"/api/v1/projects/{pid}/submit", headers=h)
    r = client.post(f"/api/v1/projects/{pid}/review?decision=reject&reason=too%20big", headers=h)
    assert r.json()["status"] == "planning"


def test_guard_rails_on_inputs(client):
    token = signup(client)
    h = auth(token)
    r = client.post("/api/v1/projects", json={"title": ""}, headers=h)
    assert r.status_code == 422
    r = client.post("/api/v1/plans", json={"goal": "x"}, headers=h)
    assert r.status_code == 422
