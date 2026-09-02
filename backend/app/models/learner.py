"""Learner model — concept mastery, misconceptions, learning profile."""
from __future__ import annotations
import time
from dataclasses import dataclass, field


@dataclass
class ConceptMastery:
    concept: str
    score: float = 0.0  # 0-1
    confidence: float = 0.0  # 0-1
    attempts: int = 0
    correct: int = 0
    last_seen: float = 0.0
    time_spent: float = 0.0  # seconds


@dataclass
class Misconception:
    concept: str
    description: str
    detected_at: float = 0.0
    resolved: bool = False


@dataclass
class LearnerProfile:
    class_id: str
    user_id: str = "default"
    concepts: dict[str, ConceptMastery] = field(default_factory=dict)
    misconceptions: list[Misconception] = field(default_factory=list)
    history: list[dict] = field(default_factory=list)
    created_at: float = field(default_factory=time.time)
    updated_at: float = field(default_factory=time.time)

    @property
    def mastery_level(self) -> float:
        if not self.concepts:
            return 0.0
        scores = [c.score for c in self.concepts.values()]
        return sum(scores) / len(scores) if scores else 0.0

    @property
    def strengths(self) -> list[str]:
        return [c.concept for c in self.concepts.values() if c.score >= 0.7]

    @property
    def weaknesses(self) -> list[str]:
        return [c.concept for c in self.concepts.values() if c.score < 0.4]

    @property
    def active_misconceptions(self) -> list[Misconception]:
        return [m for m in self.misconceptions if not m.resolved]

    def update_concept(self, concept: str, correct: bool, confidence: float = 0.5):
        now = time.time()
        if concept not in self.concepts:
            self.concepts[concept] = ConceptMastery(concept=concept)
        cm = self.concepts[concept]
        cm.attempts += 1
        if correct:
            cm.correct += 1
            cm.score = min(1.0, cm.score + 0.1 * (1 - cm.score))
        else:
            cm.score = max(0.0, cm.score - 0.15)
        cm.confidence = min(1.0, (cm.confidence * (cm.attempts - 1) + confidence) / cm.attempts)
        cm.last_seen = now
        cm.time_spent += 1.0
        self.updated_at = now

    def add_misconception(self, concept: str, description: str):
        for m in self.misconceptions:
            if m.concept == concept and not m.resolved:
                return
        self.misconceptions.append(Misconception(
            concept=concept, description=description, detected_at=time.time()
        ))

    def resolve_misconception(self, concept: str):
        for m in self.misconceptions:
            if m.concept == concept and not m.resolved:
                m.resolved = True

    def add_history(self, action: str, detail: dict | None = None):
        self.history.append({
            "action": action,
            "detail": detail or {},
            "timestamp": time.time(),
        })

    def next_best_action(self) -> str:
        if not self.concepts:
            return "diagnose"
        if self.active_misconceptions:
            return "teach_misconception"
        weaknesses = self.weaknesses
        if weaknesses:
            return "practice_weakness"
        if self.mastery_level < 0.6:
            return "quiz"
        return "flashcards"

    def to_dict(self) -> dict:
        return {
            "class_id": self.class_id,
            "user_id": self.user_id,
            "mastery_level": round(self.mastery_level, 3),
            "strengths": self.strengths,
            "weaknesses": self.weaknesses,
            "misconceptions": [
                {"concept": m.concept, "description": m.description, "resolved": m.resolved}
                for m in self.misconceptions
            ],
            "concepts": {
                k: {"score": round(v.score, 3), "attempts": v.attempts, "correct": v.correct}
                for k, v in self.concepts.items()
            },
            "total_concepts": len(self.concepts),
            "total_attempts": sum(c.attempts for c in self.concepts.values()),
            "next_best_action": self.next_best_action(),
            "study_recommendation": self._recommendation(),
        }

    def _recommendation(self) -> str:
        action = self.next_best_action()
        recs = {
            "diagnose": "Take a diagnostic assessment to identify what you know.",
            "teach_misconception": f"Review the concept '{self.active_misconceptions[0].concept}' — there's a misconception to clear up." if self.active_misconceptions else "Review your recent mistakes.",
            "practice_weakness": f"Practice weak areas: {', '.join(self.weaknesses[:3])}.",
            "quiz": "Take a quiz to solidify your understanding.",
            "flashcards": "Review flashcards to maintain mastery.",
        }
        return recs.get(action, "Keep up the great work!")
