<div align="center">

# QuickClass

**Your AI study companion that actually knows your stuff.**

Upload your lecture notes, textbooks, slides — anything.
QuickClass reads them, learns them, and becomes your personal tutor.

[![Next.js](https://img.shields.io/badge/Next.js-14-black?style=flat-square&logo=next.js)](https://nextjs.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110-009688?style=flat-square&logo=fastapi)](https://fastapi.tiangolo.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-3178c6?style=flat-square&logo=typescript)](https://typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-06b6d4?style=flat-square&logo=tailwindcss)](https://tailwindcss.com)

</div>

---

## What QuickClass does

QuickClass is what happens when you stop passively rereading notes and start **actively learning**.

Upload your course materials → ask your AI tutor questions → take adaptive quizzes → watch yourself actually understand things.

Every answer cites your own sources. Every quiz targets your weak spots. Every study session builds on the last.

### The loop

```
Upload → Diagnose → Teach → Practice → Measure → Adapt → Master
```

That's it. That's the whole product.

---

## Features

### Source Grounded Tutor
Ask "explain the citric acid cycle" and get an answer drawn from **your** lecture notes — with citations showing exactly which document and section it came from.

### Adaptive Quizzes
Quizzes that get harder when you're doing well and easier when you're struggling. Questions generated from your actual course material, not a random question bank.

### Flashcards That Work
Auto-generated from your sources. Front, back, difficulty rating. Flip to reveal. Move through them at your own pace.

### Diagnostic Assessment
Not sure where to start? QuickClass quizzes you across your material, figures out what you know and what you don't, then builds a study plan around your gaps.

### Learner Profile
Mastery tracking that updates in real-time. See your strengths, weaknesses, overall mastery level, and personalized study recommendations.

### Multi-Source Intelligence
Upload PDFs, text files, markdown — mix and match. QuickClass chunks, indexes, and cross-references everything so you can ask questions across all your materials.

---

## Built with

| Layer | What | Why |
|-------|------|-----|
| Frontend | Next.js 14, React 18, TypeScript | Fast, type-safe, great DX |
| Styling | Tailwind CSS, custom design system | Monochromatic glass aesthetic, dark mode |
| Animation | Motion (Framer Motion successor) | Smooth page transitions, micro-interactions |
| Backend | FastAPI, Python 3.11+ | Async, fast, clean API design |
| PDF Processing | PyPDF | Extract text from lecture slides and textbooks |
| AI | Provider-agnostic (Demo / OpenAI) | Works out of the box, scales to real models |

---

## How it works

1. **Create a class** — give it a name and emoji. Biology, History, CS — whatever you're studying.
2. **Upload sources** — drag in your PDFs, notes, slides. QuickClass extracts the text, chunks it intelligently, and indexes everything.
3. **Talk to your tutor** — ask questions about your material. Get answers with source citations and relevance scores.
4. **Take a quiz** — adaptive questions that focus on what you don't know yet. Explanations after every answer.
5. **Review flashcards** — auto-generated from your sources. Flip, repeat, master.
6. **Track your progress** — mastery level, strengths, weaknesses, and study recommendations that evolve as you learn.

---

## Tech highlights

- **Source-grounded RAG** — keyword matching with relevance scoring across chunked source documents
- **PDF extraction pipeline** — upload → extract → chunk (1000 chars, 200 overlap, sentence-boundary breaks) → index
- **Provider-agnostic AI** — swap between demo mode and OpenAI with a single env var
- **Glass morphism design** — monochromatic palette, CSS custom properties, full dark mode support
- **Adaptive difficulty** — quiz questions and flashcards adjust based on your learner profile

---

<div align="center">

**Made for students who actually want to learn things.**

[QuickClass](https://quickclass.dev) — Study smarter. Not harder.

</div>
