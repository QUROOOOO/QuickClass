"""QuickClass API — AI-powered study companion backend."""
from __future__ import annotations
import os
import time
import uuid
from typing import Optional

from fastapi import FastAPI, HTTPException, UploadFile, File, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from .ai.llm import chat_completion
from .ai.embeddings import embed_query, embed_documents
from .ai.prompts import (
    SYSTEM_TUTOR, TUTOR_USER, TUTOR_USER_NO_SOURCES,
    SYSTEM_QUIZ, QUIZ_USER, SYSTEM_FLASHCARD, FLASHCARD_USER,
    SYSTEM_DIAGNOSTIC, DIAGNOSTIC_USER,
    SYSTEM_LEARNER_PROFILE, LEARNER_PROFILE_USER,
    MISCONCEPTION_DETECTION, NEXT_BEST_ACTION,
)
from .services.ingestion import extract_text, chunk_text, get_source_stats
from .services.rag import search_chunks, build_source_context, format_citations
from .services.adaptive import select_quiz_questions, calculate_score, update_profile_from_quiz
from .services.spaced import FlashcardState, review_card, get_due_cards, get_card_stats
from .models.learner import LearnerProfile
from .db import sqlite as db

app = FastAPI(title="QuickClass API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory stores for flashcard review state
_flashcard_states: dict[str, dict[str, FlashcardState]] = {}  # class_id -> {card_id: state}


# ── Health ──

@app.get("/health")
async def health():
    return {"ok": True, "app": "QuickClass API"}


# ── Classes ──

@app.get("/api/v1/classes")
async def list_classes():
    return db.list_classes()


class CreateClassRequest(BaseModel):
    name: str
    emoji: str = "📚"
    description: str = ""


@app.post("/api/v1/classes")
async def create_class(req: CreateClassRequest):
    cls = db.create_class(req.name, req.emoji, req.description)
    return cls


@app.get("/api/v1/classes/{class_id}")
async def get_class(class_id: str):
    cls = db.get_class(class_id)
    if not cls:
        raise HTTPException(status_code=404, detail="Class not found")
    return cls


@app.delete("/api/v1/classes/{class_id}")
async def delete_class(class_id: str):
    db.delete_class(class_id)
    return {"ok": True}


# ── Sources ──

@app.get("/api/v1/classes/{class_id}/sources")
async def list_sources(class_id: str):
    return db.list_sources(class_id)


class CreateSourceRequest(BaseModel):
    name: str
    type: str = "text"
    content: str = ""


@app.post("/api/v1/classes/{class_id}/sources")
async def create_source(class_id: str, req: CreateSourceRequest):
    source = db.create_source(class_id=class_id, name=req.name, source_type=req.type, size=len(req.content))
    if req.content.strip():
        chunks = chunk_text(req.content)
        db.store_chunks(source["id"], chunks)
        stats = get_source_stats(req.content)
        db.update_source_status(source["id"], "ready", len(chunks), stats["words"])
        return {**source, "status": "ready", "chunk_count": len(chunks), "word_count": stats["words"]}
    return {**source, "status": "ready"}


@app.post("/api/v1/classes/{class_id}/sources/upload")
async def upload_source(class_id: str, file: UploadFile = File(...)):
    content = await file.read()
    filename = file.filename or "uploaded_file"
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else "txt"
    type_map = {"pdf": "pdf", "txt": "text", "md": "text", "docx": "document",
                "png": "image", "jpg": "image", "jpeg": "image"}
    source_type = type_map.get(ext, "document")

    # Create source record
    source = db.create_source(
        class_id=class_id, name=filename, source_type=source_type,
        size=len(content), status="processing",
    )

    # Extract and chunk text
    try:
        text = extract_text(content, ext)
        if text.strip():
            chunks = chunk_text(text)
            db.store_chunks(source["id"], chunks)
            stats = get_source_stats(text)
            db.update_source_status(source["id"], "ready", len(chunks), stats["words"])
            return {**source, "status": "ready", "chunk_count": len(chunks),
                    "word_count": stats["words"], "page_count": stats["pages"]}
        else:
            db.update_source_status(source["id"], "empty", 0, 0)
            return {**source, "status": "empty", "chunk_count": 0}
    except Exception as e:
        db.update_source_status(source["id"], "error", 0, 0)
        raise HTTPException(status_code=422, detail=f"Failed to process file: {str(e)}")


@app.delete("/api/v1/classes/{class_id}/sources/{source_id}")
async def delete_source(class_id: str, source_id: str):
    db.delete_source(source_id)
    return {"ok": True}


# ── Chat (AI Tutor) ──

class ChatRequest(BaseModel):
    class_id: str
    message: str
    history: list[dict] = []


@app.post("/api/v1/chat")
async def chat(req: ChatRequest):
    # Get relevant source chunks via RAG
    chunks = db.get_chunks(req.class_id)
    context_text = " ".join(c["content"] for c in chunks) if chunks else ""

    results = []
    if context_text.strip():
        results = search_chunks(req.message, chunks, top_k=3)
        source_context = build_source_context(results)
    else:
        source_context = ""

    # Build messages for LLM
    system = SYSTEM_TUTOR
    if source_context:
        user_msg = TUTOR_USER.format(source_context=source_context, question=req.message)
    else:
        user_msg = TUTOR_USER_NO_SOURCES.format(question=req.message)

    messages = [{"role": "system", "content": system}, {"role": "user", "content": user_msg}]
    for h in req.history[-6:]:
        messages.append({"role": h.get("role", "user"), "content": h.get("content", "")})

    response = await chat_completion(messages)
    citations = format_citations(results) if results else []

    # Save chat history
    db.save_chat(req.class_id, "user", req.message)
    db.save_chat(req.class_id, "assistant", response, citations)

    # Update learner profile from interaction
    profile = _get_or_create_profile(req.class_id)
    profile.add_history("chat", {"message": req.message[:100]})
    db.save_learner_profile(req.class_id, "default", profile.to_dict())

    return {"response": response, "sources": citations}


# ── Quiz ──

class QuizRequest(BaseModel):
    class_id: str
    count: int = 5
    topic: str = ""


@app.post("/api/v1/quiz")
async def generate_quiz(req: QuizRequest):
    # Get source chunks for source-aware questions
    chunks = db.get_chunks(req.class_id)
    context_text = " ".join(c["content"] for c in chunks) if chunks else ""

    messages = [{"role": "system", "content": SYSTEM_QUIZ}]
    user_msg = QUIZ_USER.format(
        count=req.count,
        source_context=context_text[:3000] if context_text else "General knowledge",
        easy_count=req.count // 3, medium_count=req.count // 3, hard_count=req.count - 2 * (req.count // 3),
        topic_requirement="",
    )
    messages.append({"role": "user", "content": user_msg})

    response = await chat_completion(messages, response_format={"type": "json_object"})

    import json
    try:
        data = json.loads(response)
        questions = data.get("questions", [])
    except (json.JSONDecodeError, TypeError):
        # Fallback demo questions
        questions = [
            {"question": "What is the powerhouse of the cell?", "options": ["Nucleus", "Mitochondria", "Ribosome", "Endoplasmic Reticulum"], "correct": 1, "explanation": "Mitochondria produce ATP through cellular respiration.", "topic": "Cell Biology"},
            {"question": "What process converts sunlight to chemical energy?", "options": ["Respiration", "Fermentation", "Photosynthesis", "Transcription"], "correct": 2, "explanation": "Photosynthesis uses light energy to synthesize glucose.", "topic": "Plant Biology"},
            {"question": "What is the function of ribosomes?", "options": ["Energy production", "Protein synthesis", "DNA replication", "Cell division"], "correct": 1, "explanation": "Ribosomes translate mRNA into amino acid sequences.", "topic": "Cell Biology"},
        ]

    # Adaptive selection if learner profile exists
    profile = _get_or_create_profile(req.class_id)
    if profile.concepts:
        questions = select_quiz_questions(questions, profile, req.count)

    return {"questions": questions[:req.count]}


class QuizSubmitRequest(BaseModel):
    class_id: str
    answers: list[dict]
    questions: list[dict]


@app.post("/api/v1/quiz/submit")
async def submit_quiz(req: QuizSubmitRequest):
    result = calculate_score(req.answers, req.questions)
    profile = _get_or_create_profile(req.class_id)
    profile = update_profile_from_quiz(profile, req.answers, req.questions)
    db.save_learner_profile(req.class_id, "default", profile.to_dict())
    return {**result, "profile": profile.to_dict()}


# ── Flashcards ──

class FlashcardRequest(BaseModel):
    class_id: str
    count: int = 10


@app.post("/api/v1/flashcards")
async def generate_flashcards(req: FlashcardRequest):
    chunks = db.get_chunks(req.class_id)
    context_text = " ".join(c["content"] for c in chunks) if chunks else ""

    messages = [{"role": "system", "content": SYSTEM_FLASHCARD}]
    user_msg = FLASHCARD_USER.format(
        count=req.count,
        source_context=context_text[:3000] if context_text else "General knowledge",
    )
    messages.append({"role": "user", "content": user_msg})

    response = await chat_completion(messages, response_format={"type": "json_object"})

    import json
    try:
        data = json.loads(response)
        cards = data.get("flashcards", [])
    except (json.JSONDecodeError, TypeError):
        cards = [
            {"front": "What is photosynthesis?", "back": "The process by which plants convert light energy into chemical energy (glucose).", "difficulty": "easy"},
            {"front": "What is the mitochondria?", "back": "The powerhouse of the cell — produces ATP through cellular respiration.", "difficulty": "easy"},
            {"front": "What is the central dogma of biology?", "back": "DNA → RNA → Protein. Genetic information flows from DNA to RNA to protein.", "difficulty": "medium"},
        ]

    # Initialize spaced repetition states
    class_states = _flashcard_states.setdefault(req.class_id, {})
    for i, card in enumerate(cards):
        card_id = f"{req.class_id}_card_{i}"
        if card_id not in class_states:
            class_states[card_id] = FlashcardState(card_id=card_id)

    stats = get_card_stats(class_states)
    return {"flashcards": cards, "stats": stats}


class FlashcardReviewRequest(BaseModel):
    class_id: str
    card_index: int
    quality: int  # 0-5


@app.post("/api/v1/flashcards/review")
async def review_flashcard(req: FlashcardReviewRequest):
    class_states = _flashcard_states.setdefault(req.class_id, {})
    card_id = f"{req.class_id}_card_{req.card_index}"
    state = class_states.get(card_id, FlashcardState(card_id=card_id))
    state = review_card(state, quality)
    class_states[card_id] = state
    return {
        "interval": state.interval,
        "next_review": state.next_review,
        "maturity": state.maturity,
        "ease_factor": state.ease_factor,
    }


# ── Diagnostic ──

class DiagnosticRequest(BaseModel):
    class_id: str


@app.post("/api/v1/diagnostic")
async def run_diagnostic(req: DiagnosticRequest):
    chunks = db.get_chunks(req.class_id)
    context_text = " ".join(c["content"] for c in chunks) if chunks else ""

    messages = [{"role": "system", "content": SYSTEM_DIAGNOSTIC}]
    user_msg = DIAGNOSTIC_USER.format(count=5, source_context=context_text[:3000] if context_text else "General knowledge")
    messages.append({"role": "user", "content": user_msg})

    response = await chat_completion(messages, response_format={"type": "json_object"})

    import json
    try:
        data = json.loads(response)
        questions = data.get("questions", [])
    except (json.JSONDecodeError, TypeError):
        questions = [
            {"question": "What is the main function of the cell membrane?", "options": ["Energy production", "Control what enters and exits", "Store DNA", "Make proteins"], "correct": 1, "topic": "Cell Biology"},
            {"question": "Which organelle is found in plant cells but not animal cells?", "options": ["Mitochondria", "Nucleus", "Chloroplast", "Ribosome"], "correct": 2, "topic": "Cell Biology"},
            {"question": "What is the role of enzymes?", "options": ["Store energy", "Speed up chemical reactions", "Transport molecules", "Provide structure"], "correct": 1, "topic": "Biochemistry"},
            {"question": "What is the difference between mitosis and meiosis?", "options": ["No difference", "Mitosis makes 2 cells, meiosis makes 4", "Mitosis is for plants, meiosis for animals", "Meiosis makes identical cells"], "correct": 1, "topic": "Cell Division"},
            {"question": "What is DNA replication?", "options": ["Making proteins", "Copying DNA before cell division", "Breaking down food", "Energy production"], "correct": 1, "topic": "Genetics"},
        ]

    # Run diagnostic and update learner profile
    profile = _get_or_create_profile(req.class_id)
    correct_count = 0
    for q in questions[:3]:  # Evaluate first 3 (demo)
        profile.update_concept(q.get("topic", "General"), correct=True)
        correct_count += 1
    profile.add_history("diagnostic", {"questions": len(questions), "correct": correct_count})
    db.save_learner_profile(req.class_id, "default", profile.to_dict())

    return {"questions": questions, "profile": profile.to_dict()}


# ── Learner Profile ──

@app.get("/api/v1/classes/{class_id}/profile")
async def get_learner_profile(class_id: str):
    profile = _get_or_create_profile(class_id)
    return profile.to_dict()


@app.post("/api/v1/classes/{class_id}/profile/next-action")
async def get_next_action(class_id: str):
    profile = _get_or_create_profile(class_id)
    action = profile.next_best_action()
    recommendation = profile._recommendation()
    return {"action": action, "recommendation": recommendation}


# ── Helper ──

def _get_or_create_profile(class_id: str) -> LearnerProfile:
    data = db.load_learner_profile(class_id)
    if data:
        p = LearnerProfile(class_id=class_id)
        p.concepts = data.get("concepts", {})
        p.misconceptions = data.get("misconceptions", [])
        p.history = data.get("history", [])
        return p
    return LearnerProfile(class_id=class_id)
