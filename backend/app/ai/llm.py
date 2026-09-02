"""LLM service — OpenAI-compatible chat completion with streaming support."""
from __future__ import annotations

import json
import os
from typing import AsyncIterator

import httpx


async def chat_completion(
    messages: list[dict],
    *,
    model: str | None = None,
    temperature: float = 0.7,
    max_tokens: int = 2048,
    stream: bool = False,
    response_format: dict | None = None,
) -> str | AsyncIterator[str]:
    """Send a chat completion request to the configured LLM provider.

    Falls back to a rule-based demo response when no API key is set,
    so the entire UI works end-to-end without external services.
    """
    api_key = os.getenv("OPENAI_API_KEY", "")
    base_url = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1")
    model = model or os.getenv("OPENAI_MODEL", "gpt-4o-mini")

    if not api_key:
        return _demo_response(messages, response_format=response_format)

    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
    payload = {
        "model": model,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
        "stream": stream,
    }
    if response_format:
        payload["response_format"] = response_format

    if stream:
        return _stream_completion(base_url, headers, payload)

    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(f"{base_url}/chat/completions", headers=headers, json=payload)
        resp.raise_for_status()
        data = resp.json()
        return data["choices"][0]["message"]["content"]


async def _stream_completion(base_url: str, headers: dict, payload: dict) -> AsyncIterator[str]:
    """Stream SSE chunks from the OpenAI-compatible API."""
    async with httpx.AsyncClient(timeout=120) as client:
        async with client.stream(
            "POST",
            f"{base_url}/chat/completions",
            headers=headers,
            json=payload,
        ) as resp:
            resp.raise_for_status()
            async for line in resp.aiter_lines():
                if not line.startswith("data: "):
                    continue
                data_str = line[6:]
                if data_str.strip() == "[DONE]":
                    break
                try:
                    chunk = json.loads(data_str)
                    delta = chunk["choices"][0].get("delta", {})
                    if "content" in delta:
                        yield delta["content"]
                except (json.JSONDecodeError, KeyError, IndexError):
                    continue


def _demo_response(messages: list[dict], *, response_format: dict | None = None) -> str:
    """Generate a helpful demo response when no LLM API key is configured.

    This parses the system prompt and user message to provide contextually
    relevant answers that demonstrate the product's capabilities.
    """
    user_msg = ""
    system_context = ""
    for m in messages:
        if m["role"] == "system":
            system_context += m["content"] + "\n"
        elif m["role"] == "user":
            user_msg = m["content"]

    user_lower = user_msg.lower()

    # Check if the system prompt contains source context
    has_sources = "[SOURCE MATERIAL" in system_context or "relevant content" in system_context.lower()

    # When response_format requests JSON, return structured data
    wants_json = response_format and response_format.get("type") == "json_object"

    if "diagnostic" in user_lower or "assess" in user_lower:
        return _demo_diagnostic_json() if wants_json else _demo_diagnostic_response()
    if "quiz" in user_lower or "question" in user_lower:
        return _demo_quiz_json() if wants_json else _demo_quiz_response(user_msg, has_sources)
    if "flashcard" in user_lower or "flash card" in user_lower:
        return _demo_flashcard_json() if wants_json else _demo_flashcard_response(user_msg, has_sources)
    if "explain" in user_lower or "what is" in user_lower or "how does" in user_lower:
        return _demo_explain_response(user_msg, system_context, has_sources)
    if "note" in user_lower or "summar" in user_lower:
        return _demo_notes_response(user_msg, has_sources)

    # Generic helpful response
    if has_sources:
        return (
            f"I can see you've uploaded study materials. Based on your sources, I'm ready to help with:\n\n"
            f"• **Explain** any concept in your materials\n"
            f"• **Quiz** yourself on key topics\n"
            f"• **Create flashcards** for important terms\n"
            f"• **Summarize** sections of your notes\n\n"
            f"What would you like to study? Ask me to explain a specific topic from your materials."
        )
    return (
        "I'm your AI study tutor! Upload some materials (PDFs, notes, textbooks) and I'll help you:\n\n"
        "• Explain concepts from your sources\n"
        "• Quiz you on key topics\n"
        "• Create flashcards\n"
        "• Track your learning progress\n\n"
        "What subject are you studying?"
    )


def _demo_explain_response(user_msg: str, context: str, has_sources: bool) -> str:
    topic = user_msg.replace("explain", "").replace("what is", "").replace("how does", "").strip().rstrip("?")
    if not topic:
        topic = "this topic"

    if has_sources:
        return (
            f"Great question! Let me explain **{topic}** based on your uploaded materials.\n\n"
            f"**Core Concept:**\n"
            f"From your study materials, {topic} is a fundamental concept that builds on the principles "
            f"covered in your notes. It connects to several key ideas in your course.\n\n"
            f"**Key Points:**\n"
            f"1. This concept is directly addressed in one of your uploaded sources\n"
            f"2. It relates to the broader themes you're studying\n"
            f"3. Understanding this will help with the connected topics\n\n"
            f"**In Simple Terms:**\n"
            f"Think of {topic} as a building block — it's essential for understanding the more "
            f"complex ideas in your course.\n\n"
            f"Would you like me to go deeper, or should I create flashcards for this topic?"
        )
    return (
        f"Here's an explanation of **{topic}**:\n\n"
        f"This is an important concept in your field of study. While I don't have your specific "
        f"materials uploaded yet, I can explain the general principles.\n\n"
        f"Upload your notes or textbook and I'll give you a more targeted explanation drawn "
        f"directly from your course materials!"
    )


def _demo_diagnostic_response() -> str:
    return (
        "I'll create a diagnostic assessment to understand your current knowledge level.\n\n"
        "Based on the results, I'll build your learner profile and identify:\n"
        "- Your strong areas\n"
        "- Topics that need more work\n"
        "- The best next steps for your study plan\n\n"
        "Ready to begin?"
    )


def _demo_quiz_response(msg: str, has_sources: bool) -> str:
    if has_sources:
        return (
            "I'll generate quiz questions based on your uploaded materials.\n\n"
            "The questions will focus on the key concepts from your sources, "
            "with a mix of difficulty levels to test your understanding."
        )
    return (
        "I'd love to create a quiz for you! Upload some study materials first, "
        "and I'll generate questions based on your specific content."
    )


def _demo_flashcard_response(msg: str, has_sources: bool) -> str:
    if has_sources:
        return (
            "I'll create flashcards from your uploaded materials.\n\n"
            "Each card will cover a key concept, term, or relationship "
            "from your study sources."
        )
    return (
        "Flashcards are a great study tool! Upload your materials and I'll "
        "automatically extract the key terms and concepts for you."
    )


def _demo_notes_response(msg: str, has_sources: bool) -> str:
    if has_sources:
        return (
            "Here's a structured summary of the key concepts from your materials:\n\n"
            "**Main Topics:**\n"
            "- Core concepts and definitions\n"
            "- Key relationships between ideas\n"
            "- Important formulas or processes\n\n"
            "**Study Recommendations:**\n"
            "- Review the highlighted sections\n"
            "- Practice with related flashcards\n"
            "- Test yourself with a quiz"
        )
    return (
        "I can create organized notes from your materials! Upload your "
        "documents and I'll extract and organize the key information."
    )


def _demo_quiz_json() -> str:
    return json.dumps({"questions": [
        {"question": "What is the powerhouse of the cell?", "options": ["Nucleus", "Mitochondria", "Ribosome", "Endoplasmic Reticulum"], "correct": 1, "explanation": "Mitochondria produce ATP through cellular respiration.", "topic": "Cell Biology"},
        {"question": "What process converts sunlight to chemical energy?", "options": ["Respiration", "Fermentation", "Photosynthesis", "Transcription"], "correct": 2, "explanation": "Photosynthesis uses light energy to synthesize glucose.", "topic": "Plant Biology"},
        {"question": "What is the function of ribosomes?", "options": ["Energy production", "Protein synthesis", "DNA replication", "Cell division"], "correct": 1, "explanation": "Ribosomes translate mRNA into amino acid sequences.", "topic": "Cell Biology"},
        {"question": "Which molecule carries genetic information?", "options": ["RNA", "DNA", "Protein", "Lipids"], "correct": 1, "explanation": "DNA stores genetic information in nucleotide sequences.", "topic": "Genetics"},
        {"question": "What is the cell membrane primarily composed of?", "options": ["Carbohydrates", "Phospholipid bilayer", "Nucleic acids", "Amino acids"], "correct": 1, "explanation": "The phospholipid bilayer forms the basic structure of cell membranes.", "topic": "Cell Biology"},
    ]})


def _demo_flashcard_json() -> str:
    return json.dumps({"flashcards": [
        {"front": "What is photosynthesis?", "back": "The process by which plants convert light energy into chemical energy (glucose), using CO₂ and water.", "difficulty": "easy"},
        {"front": "What is the mitochondria?", "back": "The powerhouse of the cell — produces ATP through cellular respiration.", "difficulty": "easy"},
        {"front": "What is the central dogma of biology?", "back": "DNA → RNA → Protein. Genetic information flows from DNA to RNA to protein.", "difficulty": "medium"},
        {"front": "What is osmosis?", "back": "The movement of water molecules across a semipermeable membrane from low to high solute concentration.", "difficulty": "medium"},
        {"front": "What is the difference between mitosis and meiosis?", "back": "Mitosis produces 2 identical daughter cells (2n). Meiosis produces 4 genetically unique haploid cells (n).", "difficulty": "medium"},
        {"front": "What is a codon?", "back": "A sequence of three nucleotides in mRNA that codes for a specific amino acid.", "difficulty": "hard"},
        {"front": "What is ATP?", "back": "Adenosine triphosphate — the primary energy currency of cells, storing energy in phosphate bonds.", "difficulty": "easy"},
        {"front": "What are the four nucleotide bases in DNA?", "back": "Adenine (A), Thymine (T), Guanine (G), and Cytosine (C).", "difficulty": "easy"},
        {"front": "What is the difference between prokaryotic and eukaryotic cells?", "back": "Prokaryotes lack a nucleus and membrane-bound organelles. Eukaryotes have both.", "difficulty": "medium"},
        {"front": "What is an enzyme?", "back": "A biological catalyst (usually a protein) that speeds up chemical reactions without being consumed.", "difficulty": "medium"},
    ]})


def _demo_diagnostic_json() -> str:
    return json.dumps({"questions": [
        {"question": "What is the main function of the cell membrane?", "options": ["Energy production", "Control what enters and exits", "Store DNA", "Make proteins"], "correct": 1, "topic": "Cell Biology"},
        {"question": "Which organelle is found in plant cells but not animal cells?", "options": ["Mitochondria", "Nucleus", "Chloroplast", "Ribosome"], "correct": 2, "topic": "Cell Biology"},
        {"question": "What is the role of enzymes?", "options": ["Store energy", "Speed up chemical reactions", "Transport molecules", "Provide structure"], "correct": 1, "topic": "Biochemistry"},
        {"question": "What is the difference between mitosis and meiosis?", "options": ["No difference", "Mitosis makes 2 cells, meiosis makes 4", "Mitosis is for plants, meiosis for animals", "Meiosis makes identical cells"], "correct": 1, "topic": "Cell Division"},
        {"question": "What is DNA replication?", "options": ["Making proteins", "Copying DNA before cell division", "Breaking down food", "Energy production"], "correct": 1, "topic": "Genetics"},
    ]})
