"""QuickClass API — AI-powered study companion backend."""
from __future__ import annotations

import os
import time
import uuid
from typing import Optional

from fastapi import FastAPI, File, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from app.config import get_settings
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

# In-memory stores for demo
app.state.users = []
app.state.classes = []
app.state.sources = []
app.state.source_content = {}  # source_id -> extracted text chunks


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


# ── Classes ────────────────────────────────────────────────


class ClassCreate(BaseModel):
    name: str
    emoji: str = "📚"
    description: str = ""


class ClassResponse(BaseModel):
    id: str
    name: str
    emoji: str
    description: str
    sources: int = 0
    progress: int = 0


@app.get("/api/v1/classes")
def list_classes():
    return app.state.classes


@app.post("/api/v1/classes", status_code=201)
def create_class(body: ClassCreate):
    cls = {
        "id": f"cls-{uuid.uuid4().hex[:8]}",
        "name": body.name,
        "emoji": body.emoji,
        "description": body.description,
        "sources": 0,
        "progress": 0,
    }
    app.state.classes.insert(0, cls)
    return cls


@app.get("/api/v1/classes/{class_id}")
def get_class(class_id: str):
    for cls in app.state.classes:
        if cls["id"] == class_id:
            return cls
    return JSONResponse(status_code=404, content={"detail": "Class not found"})


@app.delete("/api/v1/classes/{class_id}", status_code=204)
def delete_class(class_id: str):
    app.state.classes = [c for c in app.state.classes if c["id"] != class_id]


# ── Sources ────────────────────────────────────────────────

class SourceCreate(BaseModel):
    class_id: str
    name: str
    type: str = "document"  # document, url, text
    content: Optional[str] = None


class SourceResponse(BaseModel):
    id: str
    class_id: str
    name: str
    type: str
    status: str = "processing"
    chunks: int = 0
    size: str = ""


def extract_text_from_pdf(content: bytes) -> str:
    """Extract text from PDF using pypdf."""
    try:
        from pypdf import PdfReader
        import io
        reader = PdfReader(io.BytesIO(content))
        text_parts = []
        for page in reader.pages:
            text = page.extract_text()
            if text:
                text_parts.append(text)
        return "\n\n".join(text_parts)
    except Exception as e:
        return f"[Error extracting PDF: {str(e)}]"


def chunk_text(text: str, chunk_size: int = 1000, overlap: int = 200) -> list[str]:
    """Split text into overlapping chunks for RAG."""
    if not text:
        return []
    
    chunks = []
    start = 0
    while start < len(text):
        end = start + chunk_size
        chunk = text[start:end]
        
        # Try to break at sentence boundary
        if end < len(text):
            last_period = chunk.rfind('.')
            last_newline = chunk.rfind('\n')
            break_point = max(last_period, last_newline)
            if break_point > chunk_size * 0.5:  # At least 50% of chunk
                chunk = chunk[:break_point + 1]
                end = start + break_point + 1
        
        chunks.append(chunk.strip())
        start = end - overlap
    
    return [c for c in chunks if c]  # Remove empty chunks


@app.get("/api/v1/classes/{class_id}/sources")
def list_sources(class_id: str):
    return [s for s in app.state.sources if s["class_id"] == class_id]


@app.post("/api/v1/classes/{class_id}/sources", status_code=201)
def create_source(class_id: str, body: SourceCreate):
    source = {
        "id": f"src-{uuid.uuid4().hex[:8]}",
        "class_id": class_id,
        "name": body.name,
        "type": body.type,
        "status": "ready",  # demo: instant ready
        "chunks": 42,
        "size": "1.2 MB",
    }
    app.state.sources.append(source)
    
    # Store content if provided
    if body.content:
        chunks = chunk_text(body.content)
        app.state.source_content[source["id"]] = chunks
    
    # Update class source count
    for cls in app.state.classes:
        if cls["id"] == class_id:
            cls["sources"] = len([s for s in app.state.sources if s["class_id"] == class_id])
    return source


@app.post("/api/v1/classes/{class_id}/sources/upload", status_code=201)
async def upload_source(class_id: str, file: UploadFile = File(...)):
    """Upload a file as a source. Accepts PDF, DOCX, TXT, MD, images."""
    content = await file.read()
    size_bytes = len(content)
    if size_bytes < 1024:
        size_str = f"{size_bytes} B"
    elif size_bytes < 1024 * 1024:
        size_str = f"{size_bytes / 1024:.1f} KB"
    else:
        size_str = f"{size_bytes / (1024 * 1024):.1f} MB"

    # Determine type from extension
    ext = os.path.splitext(file.filename or "")[1].lower()
    type_map = {
        ".pdf": "pdf",
        ".docx": "docx",
        ".doc": "docx",
        ".txt": "text",
        ".md": "text",
        ".png": "image",
        ".jpg": "image",
        ".jpeg": "image",
    }
    file_type = type_map.get(ext, "document")
    
    # Extract text based on file type
    extracted_text = ""
    if ext == ".pdf":
        extracted_text = extract_text_from_pdf(content)
    elif ext in [".txt", ".md"]:
        try:
            extracted_text = content.decode("utf-8")
        except UnicodeDecodeError:
            extracted_text = content.decode("latin-1")
    elif ext in [".png", ".jpg", ".jpeg"]:
        # For images, we'll just note it's an image (OCR would go here)
        extracted_text = f"[Image file: {file.filename}]"
    else:
        # Try to read as text
        try:
            extracted_text = content.decode("utf-8")
        except UnicodeDecodeError:
            extracted_text = f"[Binary file: {file.filename}]"
    
    # Chunk the extracted text
    chunks = chunk_text(extracted_text)
    
    source = {
        "id": f"src-{uuid.uuid4().hex[:8]}",
        "class_id": class_id,
        "name": file.filename or "Untitled",
        "type": file_type,
        "status": "ready" if chunks else "empty",
        "chunks": len(chunks),
        "size": size_str,
    }
    app.state.sources.append(source)
    
    # Store the chunks for RAG
    app.state.source_content[source["id"]] = chunks
    
    # Update class source count
    for cls in app.state.classes:
        if cls["id"] == class_id:
            cls["sources"] = len([s for s in app.state.sources if s["class_id"] == class_id])
    
    return source


@app.delete("/api/v1/classes/{class_id}/sources/{source_id}", status_code=204)
def delete_source(class_id: str, source_id: str):
    app.state.sources = [s for s in app.state.sources if not (s["class_id"] == class_id and s["id"] == source_id)]
    # Clean up content
    if source_id in app.state.source_content:
        del app.state.source_content[source_id]
    for cls in app.state.classes:
        if cls["id"] == class_id:
            cls["sources"] = len([s for s in app.state.sources if s["class_id"] == class_id])


# ── Chat (AI Tutor) ────────────────────────────────────────

class ChatMessage(BaseModel):
    message: str
    class_id: str


def find_relevant_chunks(message: str, class_id: str, top_k: int = 3) -> list[dict]:
    """Find relevant chunks from sources for the given message."""
    message_lower = message.lower()
    results = []
    
    for source in app.state.sources:
        if source["class_id"] != class_id:
            continue
        
        source_id = source["id"]
        if source_id not in app.state.source_content:
            continue
        
        chunks = app.state.source_content[source_id]
        for i, chunk in enumerate(chunks):
            # Simple keyword matching (in production, use embeddings)
            chunk_lower = chunk.lower()
            words = message_lower.split()
            matches = sum(1 for word in words if word in chunk_lower)
            score = matches / len(words) if words else 0
            
            if score > 0.1:  # At least 10% keyword overlap
                results.append({
                    "source_name": source["name"],
                    "chunk_index": i,
                    "content": chunk[:500],  # First 500 chars
                    "relevance": round(score, 2),
                })
    
    # Sort by relevance and return top_k
    results.sort(key=lambda x: x["relevance"], reverse=True)
    return results[:top_k]


@app.post("/api/v1/chat")
def chat(body: ChatMessage):
    # Find relevant chunks from uploaded sources
    relevant_chunks = find_relevant_chunks(body.message, body.class_id)
    
    if relevant_chunks:
        # Build context from relevant chunks
        context = "\n\n".join([f"[Source: {c['source_name']}]\n{c['content']}" for c in relevant_chunks])
        
        # Generate a response based on the context (demo: echo with context)
        response = f"Based on your uploaded materials, here's what I found:\n\n"
        response += f"I found {len(relevant_chunks)} relevant section(s) from your sources.\n\n"
        response += f"**Key points:**\n"
        for i, chunk in enumerate(relevant_chunks[:3], 1):
            # Extract first sentence or so
            first_sentence = chunk['content'].split('.')[0] + '.'
            response += f"{i}. {first_sentence}\n"
        
        response += f"\nWould you like me to explain any of these concepts in more detail?"
        
        sources = [
            {"name": c["source_name"], "relevance": c["relevance"]}
            for c in relevant_chunks
        ]
    else:
        # No relevant sources found
        response = f"I understand you're asking about: '{body.message}'. "
        response += "I don't have any uploaded materials that match this topic yet. "
        response += "Try uploading some notes or textbooks, and I'll be able to help you better!"
        sources = []
    
    return {
        "response": response,
        "sources": sources,
    }


# ── Quiz ───────────────────────────────────────────────────

class QuizRequest(BaseModel):
    class_id: str
    topic: str = ""
    count: int = 5


class QuizQuestion(BaseModel):
    question: str
    options: list[str]
    correct: int
    explanation: str


@app.post("/api/v1/quiz")
def generate_quiz(body: QuizRequest):
    # Check if we have sources for this class
    class_sources = [s for s in app.state.sources if s["class_id"] == body.class_id]
    
    if class_sources:
        # In production, generate quiz from source content
        # For demo, return source-aware questions
        source_names = [s["name"] for s in class_sources[:3]]
        questions = [
            {
                "question": f"Based on {source_names[0] if source_names else 'your materials'}, what is the main concept discussed?",
                "options": [
                    "Concept A",
                    "Concept B",
                    "Concept C",
                    "Concept D",
                ],
                "correct": 0,
                "explanation": f"This concept is covered in {source_names[0] if source_names else 'your uploaded materials'}.",
            },
            {
                "question": "Which of the following is a key takeaway from the materials?",
                "options": [
                    "Key takeaway 1",
                    "Key takeaway 2",
                    "Key takeaway 3",
                    "Key takeaway 4",
                ],
                "correct": 1,
                "explanation": "This is an important point to remember from your studies.",
            },
        ]
    else:
        # Default quiz when no sources
        questions = [
            {
                "question": "What is the primary function of mitochondria?",
                "options": [
                    "Protein synthesis",
                    "ATP production (cellular respiration)",
                    "DNA replication",
                    "Cell division",
                ],
                "correct": 1,
                "explanation": "Mitochondria are known as the powerhouse of the cell because they generate most of the cell's ATP through oxidative phosphorylation.",
            },
            {
                "question": "Which organelle is responsible for photosynthesis?",
                "options": [
                    "Ribosome",
                    "Golgi apparatus",
                    "Chloroplast",
                    "Endoplasmic reticulum",
                ],
                "correct": 2,
                "explanation": "Chloroplasts contain chlorophyll and are the site of photosynthesis in plant cells.",
            },
            {
                "question": "What is the role of DNA helicase?",
                "options": [
                    "Join Okazaki fragments",
                    "Unwind the DNA double helix",
                    "Add nucleotides to the growing strand",
                    "Proofread newly synthesized DNA",
                ],
                "correct": 1,
                "explanation": "DNA helicase unwinds the double helix by breaking hydrogen bonds between base pairs, creating the replication fork.",
            },
        ]
    
    return {"questions": questions[: body.count]}


# ── Flashcards ─────────────────────────────────────────────

class FlashcardRequest(BaseModel):
    class_id: str
    count: int = 10
    topic: str = ""


@app.post("/api/v1/flashcards")
def generate_flashcards(body: FlashcardRequest):
    # Check if we have sources
    class_sources = [s for s in app.state.sources if s["class_id"] == body.class_id]
    
    if class_sources:
        # Generate flashcards from source content
        cards = [
            {"front": f"Key concept from {class_sources[0]['name']}", "back": "This is an important concept to remember", "difficulty": "medium"},
            {"front": "Definition of main topic", "back": "The core idea discussed in your materials", "difficulty": "easy"},
            {"front": "Application of knowledge", "back": "How to apply what you've learned", "difficulty": "hard"},
        ]
    else:
        # Default flashcards
        cards = [
            {"front": "What is the powerhouse of the cell?", "back": "Mitochondria — produces ATP through cellular respiration", "difficulty": "easy"},
            {"front": "What is ATP?", "back": "Adenosine triphosphate — the primary energy currency of cells", "difficulty": "easy"},
            {"front": "What is cellular respiration?", "back": "The metabolic process by which cells break down glucose to produce ATP", "difficulty": "medium"},
            {"front": "What is the electron transport chain?", "back": "A series of protein complexes in mitochondria that generate ATP through oxidative phosphorylation", "difficulty": "hard"},
            {"front": "What is the role of oxygen in respiration?", "back": "Final electron acceptor in the electron transport chain, forming water", "difficulty": "medium"},
            {"front": "What is glycolysis?", "back": "The first step of cellular respiration, breaking glucose into pyruvate in the cytoplasm", "difficulty": "medium"},
            {"front": "What is the Krebs cycle?", "back": "A series of reactions that generate energy by oxidizing acetyl-CoA in the mitochondrial matrix", "difficulty": "hard"},
            {"front": "What are reactants of photosynthesis?", "back": "Carbon dioxide + water + light energy → glucose + oxygen", "difficulty": "easy"},
            {"front": "What is the difference between DNA and RNA?", "back": "DNA is double-stranded with thymine; RNA is single-stranded with uracil", "difficulty": "easy"},
            {"front": "What is a ribosome?", "back": "A molecular machine that synthesizes proteins by translating mRNA", "difficulty": "medium"},
        ]
    
    return {"flashcards": cards[: body.count]}


# ── Diagnostic Assessment ──────────────────────────────────

class DiagnosticRequest(BaseModel):
    class_id: str


@app.post("/api/v1/diagnostic")
def run_diagnostic(body: DiagnosticRequest):
    questions = [
        {"question": "Which organelle is known as the powerhouse of the cell?", "options": ["Nucleus", "Mitochondria", "Ribosome", "Golgi apparatus"], "correct": 1, "topic": "Cell Structure"},
        {"question": "What is the primary function of mitochondria?", "options": ["Protein synthesis", "ATP production", "Cell division", "DNA replication"], "correct": 1, "topic": "Cellular Energy"},
        {"question": "What molecule carries energy within cells?", "options": ["DNA", "RNA", "ATP", "Glucose"], "correct": 2, "topic": "Cellular Energy"},
        {"question": "What is the first step of cellular respiration?", "options": ["Krebs cycle", "Electron transport chain", "Glycolysis", "Oxidative phosphorylation"], "correct": 2, "topic": "Metabolism"},
        {"question": "Which organelle performs photosynthesis?", "options": ["Mitochondria", "Chloroplast", "Ribosome", "Lysosome"], "correct": 1, "topic": "Cell Structure"},
    ]
    return {"questions": questions}


# ── Learner Profile ────────────────────────────────────────

@app.get("/api/v1/classes/{class_id}/profile")
def get_learner_profile(class_id: str):
    # Count sources for this class
    source_count = len([s for s in app.state.sources if s["class_id"] == class_id])
    
    return {
        "class_id": class_id,
        "strengths": ["Active participation", "Regular study habits"] if source_count > 0 else [],
        "weaknesses": ["Upload more materials to get personalized analysis"] if source_count == 0 else ["Advanced topics", "Application-based questions"],
        "mastery_level": min(0.3 + (source_count * 0.1), 0.9),
        "study_recommendation": f"You have {source_count} source(s) uploaded. {'Try taking a quiz to test your knowledge!' if source_count > 0 else 'Upload some notes or textbooks to get started!'}",
        "total_quizzes_taken": 0,
        "average_score": 0.0,
        "total_study_time_minutes": 0,
        "last_updated": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }
