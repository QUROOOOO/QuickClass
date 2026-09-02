"""Adaptive quiz engine — selects questions based on learner model."""
from __future__ import annotations
import random
from ..models.learner import LearnerProfile


def select_quiz_questions(
    all_questions: list[dict],
    profile: LearnerProfile | None,
    count: int = 5,
) -> list[dict]:
    if not profile or not profile.concepts:
        return random.sample(all_questions, min(count, len(all_questions)))

    scored = []
    for q in all_questions:
        topic = q.get("topic", "").lower()
        priority = 0.5

        for concept, mastery in profile.concepts.items():
            if concept.lower() in topic or topic in concept.lower():
                if mastery.score < 0.4:
                    priority = 1.0  # High priority — weak area
                elif mastery.score < 0.7:
                    priority = 0.7
                else:
                    priority = 0.3  # Low priority — already strong

        for m in profile.active_misconceptions:
            if m.concept.lower() in topic or topic in m.concept.lower():
                priority = 1.0  # Misconception — definitely quiz on this

        scored.append((q, priority))

    scored.sort(key=lambda x: x[1], reverse=True)
    selected = [q for q, _ in scored[:count]]
    if len(selected) < count:
        remaining = [q for q, _ in scored[count:]]
        selected.extend(random.sample(remaining, min(count - len(selected), len(remaining))))
    random.shuffle(selected)
    return selected


def calculate_score(answers: list[dict], questions: list[dict]) -> dict:
    correct = 0
    total = len(questions)
    topic_scores: dict[str, dict] = {}

    for ans, q in zip(answers, questions):
        topic = q.get("topic", "General")
        if topic not in topic_scores:
            topic_scores[topic] = {"correct": 0, "total": 0}
        topic_scores[topic]["total"] += 1
        is_correct = ans.get("selected") == q.get("correct")
        if is_correct:
            correct += 1
            topic_scores[topic]["correct"] += 1

    return {
        "score": round(correct / total * 100, 1) if total else 0,
        "correct": correct,
        "total": total,
        "topic_scores": {
            k: {"score": round(v["correct"] / v["total"] * 100, 1), **v}
            for k, v in topic_scores.items()
        },
    }


def update_profile_from_quiz(
    profile: LearnerProfile,
    answers: list[dict],
    questions: list[dict],
) -> LearnerProfile:
    for ans, q in zip(answers, questions):
        topic = q.get("topic", "General")
        is_correct = ans.get("selected") == q.get("correct")
        profile.update_concept(topic, correct=is_correct)
        if not is_correct:
            profile.add_misconception(topic, f"Incorrect answer on: {q.get('question', '')[:100]}")
        else:
            profile.resolve_misconception(topic)
    profile.add_history("quiz", {"score": calculate_score(answers, questions)})
    return profile
