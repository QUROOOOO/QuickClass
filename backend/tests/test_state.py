"""The state machine must only allow legal moves."""
from app.domain.models import ProjectStatus as PS
from app.domain.state import can_transition, transition
from app.errors import Conflict


def test_legal_chain():
    chain = [
        (PS.DRAFT, PS.PLANNING),
        (PS.PLANNING, PS.AWAITING_REVIEW),
        (PS.AWAITING_REVIEW, PS.APPROVED),
        (PS.APPROVED, PS.EXECUTING),
        (PS.EXECUTING, PS.TESTING),
        (PS.TESTING, PS.REVIEWING),
        (PS.REVIEWING, PS.VERIFIED),
        (PS.VERIFIED, PS.COMPLETED),
    ]
    for current, target in chain:
        assert can_transition(current, target), f"{current} -> {target}"


def test_illegal_move_rejected():
    assert not can_transition(PS.DRAFT, PS.COMPLETED)
    assert not can_transition(PS.AWAITING_REVIEW, PS.EXECUTING)
    assert not can_transition(PS.COMPLETED, PS.VERIFIED)


def test_recovery_paths():
    assert can_transition(PS.BLOCKED, PS.PLANNING)
    assert can_transition(PS.FAILED, PS.PLANNING)
    assert can_transition(PS.AWAITING_REVIEW, PS.PLANNING)  # rejection


def test_transition_raises_on_illegal():
    try:
        transition(PS.DRAFT, PS.COMPLETED)
        raise AssertionError("should have raised")
    except Conflict as exc:
        assert "draft" in exc.message and "completed" in exc.message
