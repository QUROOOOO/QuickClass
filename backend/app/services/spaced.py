"""Spaced repetition for flashcards (SM-2 simplified)."""
from __future__ import annotations
import time
from dataclasses import dataclass, field


@dataclass
class FlashcardState:
    card_id: str
    ease_factor: float = 2.5
    interval: float = 1.0  # days
    repetitions: int = 0
    last_review: float = 0.0
    next_review: float = 0.0

    @property
    def is_due(self) -> bool:
        return time.time() >= self.next_review if self.next_review else True

    @property
    def maturity(self) -> str:
        if self.repetitions >= 5:
            return "mature"
        elif self.repetitions >= 1:
            return "young"
        return "new"


def review_card(state: FlashcardState, quality: int) -> FlashcardState:
    if quality < 3:
        state.repetitions = 0
        state.interval = 1.0
    else:
        if state.repetitions == 0:
            state.interval = 1.0
        elif state.repetitions == 1:
            state.interval = 3.0
        else:
            state.interval = state.interval * state.ease_factor
        state.repetitions += 1

    state.ease_factor = max(1.3, state.ease_factor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)))
    state.last_review = time.time()
    state.next_review = state.last_review + state.interval * 86400
    return state


def get_due_cards(states: dict[str, FlashcardState]) -> list[str]:
    return [cid for cid, s in states.items() if s.is_due]


def get_card_stats(states: dict[str, FlashcardState]) -> dict:
    total = len(states)
    due = sum(1 for s in states.values() if s.is_due)
    mature = sum(1 for s in states.values() if s.maturity == "mature")
    young = sum(1 for s in states.values() if s.maturity == "young")
    new = sum(1 for s in states.values() if s.maturity == "new")
    avg_ease = sum(s.ease_factor for s in states.values()) / total if total else 2.5
    return {"total": total, "due": due, "mature": mature, "young": young,
            "new": new, "avg_ease": round(avg_ease, 2)}
