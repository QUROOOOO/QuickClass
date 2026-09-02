'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { IconFile, IconPlus, IconCheck, IconSpark, IconChevronLeft, IconClose, IconRefresh } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { LivingKnowledgeField } from '@/components/spatial/LivingKnowledgeField';
import {
  listSources,
  uploadSource,
  deleteSource,
  sendChat,
  generateQuiz,
  generateFlashcards,
  type SourceData,
  type QuizQuestion,
  type FlashcardData
} from '@/lib/api';

type ClassTab = 'tutor' | 'sources' | 'notes' | 'flashcards' | 'quiz' | 'mastery';

interface ClassDetailViewProps {
  classId: string;
  className: string;
  emoji: string;
  onBack: () => void;
}

export function ClassDetailView({ classId, className, emoji, onBack }: ClassDetailViewProps) {
  const [activeTab, setActiveTab] = useState<ClassTab>('tutor');
  const [sources, setSources] = useState<SourceData[]>([]);
  const [loadingSources, setLoadingSources] = useState(true);

  const tabs: { id: ClassTab; label: string }[] = [
    { id: 'tutor', label: 'Tutor' },
    { id: 'sources', label: 'Sources' },
    { id: 'notes', label: 'Notes' },
    { id: 'flashcards', label: 'Flashcards' },
    { id: 'quiz', label: 'Quiz' },
    { id: 'mastery', label: 'Mastery' },
  ];

  useEffect(() => {
    if (activeTab === 'sources') fetchSources();
  }, [activeTab, classId]);

  const fetchSources = async () => {
    setLoadingSources(true);
    try {
      const data = await listSources(classId);
      setSources(data);
    } catch {
      setSources([
        { id: 'src_demo_1', class_id: classId, name: 'Biology Textbook Chapter 3.pdf', type: 'pdf', status: 'ready', chunks: 45, size: '2.4 MB' },
        { id: 'src_demo_2', class_id: classId, name: 'Lecture Notes - Cell Structure.docx', type: 'docx', status: 'ready', chunks: 12, size: '156 KB' },
      ]);
    } finally {
      setLoadingSources(false);
    }
  };

  const handleUpload = async (file: File) => {
    try {
      const newSource = await uploadSource(classId, file);
      setSources(prev => [newSource, ...prev]);
    } catch {
      setSources(prev => [{
        id: `local_${Date.now()}`,
        class_id: classId,
        name: file.name,
        type: file.name.split('.').pop() || 'unknown',
        status: 'ready',
        chunks: Math.max(1, Math.floor(file.size / 2000)),
        size: formatFileSize(file.size),
      }, ...prev]);
    }
  };

  const handleDeleteSource = async (sourceId: string) => {
    try { await deleteSource(classId, sourceId); } finally {
      setSources(prev => prev.filter(s => s.id !== sourceId));
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-4 mb-6"
      >
        <button onClick={onBack} className="icon-button" aria-label="Back to classes">
          <IconChevronLeft className="w-5 h-5" />
        </button>
        <span className="text-2xl">{emoji}</span>
        <div>
          <h1 className="text-display-lg text-text-primary">{className}</h1>
          <p className="text-[12px] text-text-secondary">Study room, AI Tutor, {sources.length || '—'} sources</p>
        </div>
      </motion.div>

      {/* Tabs — segmented editorial */}
      <div className="segmented mb-8">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            data-active={activeTab === tab.id}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
        >
          {activeTab === 'tutor' && <TutorView classId={classId} />}
          {activeTab === 'sources' && <SourcesView sources={sources} loading={loadingSources} onUpload={handleUpload} onDelete={handleDeleteSource} />}
          {activeTab === 'notes' && <NotesView />}
          {activeTab === 'flashcards' && <FlashcardsView classId={classId} />}
          {activeTab === 'quiz' && <QuizView classId={classId} />}
          {activeTab === 'mastery' && <MasteryView />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/* ═══════════════════════════════════════════
   TUTOR — Context rail, NOT ChatGPT style.
   Source-grounded, citation-first design.
   ═══════════════════════════════════════════ */

function TutorView({ classId }: { classId: string }) {
  const [messages, setMessages] = useState<Array<{
    role: 'user' | 'assistant';
    content: string;
    sources?: { name: string; relevance: number }[];
  }>>([{
    role: 'assistant',
    content: "What would you like to understand better? I can explain concepts, walk through processes, or quiz you on your materials.",
  }]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setLoading(true);
    try {
      const response = await sendChat(classId, userMessage);
      setMessages(prev => [...prev, { role: 'assistant', content: response.response, sources: response.sources }]);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: `I understand you're asking about: "${userMessage}". Upload some course materials and I'll give you source-grounded answers.` }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid lg:grid-cols-[1fr_280px] gap-6">
      {/* Main chat area */}
      <div className="flex flex-col">
        <div className="flex-1 overflow-y-auto space-y-4 mb-4 max-h-[50vh]">
          {messages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className={`${msg.role === 'user' ? 'ml-12' : ''}`}
            >
              {msg.role === 'assistant' && (
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="w-5 h-5 rounded-full bg-accent-soft flex items-center justify-center">
                    <IconSpark size={10} className="text-accent" />
                  </div>
                  <span className="label-micro">TUTOR</span>
                </div>
              )}
              <div className={`${msg.role === 'user' ? 'bg-accent text-white rounded-2xl rounded-br-md px-4 py-2.5 ml-auto max-w-[85%]' : 'surface-panel px-4 py-3'}`}>
                <p className="text-[13.5px] leading-relaxed whitespace-pre-wrap">{msg.content}</p>
              </div>
              {msg.sources && msg.sources.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {msg.sources.map((source, j) => (
                    <span key={j} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--info-soft)] text-[10px] font-medium text-[var(--info)]">
                      <IconFile size={9} />
                      {source.name}
                      <span className="opacity-60">{Math.round(source.relevance * 100)}%</span>
                    </span>
                  ))}
                </div>
              )}
            </motion.div>
          ))}
          {loading && (
            <div className="ml-12">
              <div className="surface-panel px-4 py-3 inline-flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-text-faint rounded-full animate-pulse-dot" />
                <span className="w-1.5 h-1.5 bg-text-faint rounded-full animate-pulse-dot" style={{ animationDelay: '0.2s' }} />
                <span className="w-1.5 h-1.5 bg-text-faint rounded-full animate-pulse-dot" style={{ animationDelay: '0.4s' }} />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input — writing surface */}
        <div className="writing-surface flex items-center gap-3 px-4 py-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder="Ask about your materials..."
            className="flex-1 bg-transparent text-[13.5px] text-text-primary placeholder:text-text-faint focus:outline-none"
            disabled={loading}
          />
          <button
            onClick={handleSend}
            disabled={loading || !input.trim()}
            className="btn-accent control px-3 py-1.5 rounded-full text-[12px] font-medium disabled:opacity-30"
          >
            Send
          </button>
        </div>
      </div>

      {/* Context rail — source citations sidebar */}
      <div className="hidden lg:block space-y-4">
        <div className="surface-panel p-4">
          <p className="label-caps mb-3">Source Context</p>
          <p className="text-[12px] text-text-secondary leading-relaxed">
            Answers are grounded in your uploaded materials. Citations appear below each response.
          </p>
        </div>
        <div className="surface-panel p-4">
          <p className="label-caps mb-2">Suggested Questions</p>
          <div className="space-y-1.5">
            {["Explain glycolysis step by step", "What are the differences between mitosis and meiosis?", "How does ATP synthase work?"].map((q, i) => (
              <button key={i} className="w-full text-left text-[12px] text-text-secondary hover:text-text-primary py-1.5 border-b border-[var(--border)] last:border-0 transition-colors">
                {q}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   SOURCES — Upload, list, manage
   ═══════════════════════════════════════════ */

function SourcesView({ sources, loading, onUpload, onDelete }: {
  sources: SourceData[];
  loading: boolean;
  onUpload: (file: File) => void;
  onDelete: (sourceId: string) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-display-sm text-text-primary">Uploaded Sources</h2>
          <p className="text-[12px] text-text-secondary mt-0.5">{sources.length} materials indexed</p>
        </div>
        <input ref={fileInputRef} type="file" className="hidden" accept=".pdf,.docx,.doc,.txt,.md,.png,.jpg,.jpeg" onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) { onUpload(file); e.target.value = ''; }
        }} />
        <button
          onClick={() => fileInputRef.current?.click()}
          className="btn-accent control flex items-center gap-2 px-4 py-2 text-[13px] font-medium rounded-full"
        >
          <IconPlus size={14} /> Upload
        </button>
      </div>

      {loading ? (
        <div className="grid place-items-center py-16">
          <div className="w-8 h-8 border-2 border-text-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : sources.length === 0 ? (
        <div className="text-center py-16">
          <IconFile size={32} className="text-text-faint mx-auto mb-3" />
          <p className="text-[13px] text-text-secondary">No sources uploaded yet</p>
          <p className="text-[12px] text-text-faint mt-1">Upload PDFs, notes, or slides to get started</p>
        </div>
      ) : (
        <div className="space-y-2">
          {sources.map((source) => (
            <div key={source.id} className="surface-panel p-4 flex items-center gap-4">
              <div className="w-9 h-9 rounded-card bg-accent-soft flex items-center justify-center flex-shrink-0">
                <IconFile size={15} className="text-accent" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-text-primary truncate">{source.name}</p>
                <p className="text-[11px] text-text-secondary">{source.size}, {source.chunks} chunks</p>
              </div>
              <Badge tone={source.status === 'ready' ? 'success' : source.status === 'processing' ? 'warning' : 'error'}>
                {source.status}
              </Badge>
              <button onClick={() => onDelete(source.id)} className="icon-button">
                <IconClose size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════
   NOTES — Study notes
   ═══════════════════════════════════════════ */

function NotesView() {
  const [notes] = useState([
    { id: '1', title: 'Cell Structure Summary', content: 'Key organelles and their functions...', createdAt: '2 hours ago' },
    { id: '2', title: 'Cellular Respiration', content: 'The process of converting glucose to ATP...', createdAt: '1 day ago' },
  ]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-display-sm text-text-primary">Study Notes</h2>
        <button className="btn-accent control flex items-center gap-2 px-4 py-2 text-[13px] font-medium rounded-full">
          <IconPlus size={14} /> New Note
        </button>
      </div>
      <div className="grid gap-3">
        {notes.map((note) => (
          <div key={note.id} className="surface-panel p-4 cursor-pointer hover:shadow-soft transition-all">
            <h3 className="text-[13px] font-semibold text-text-primary mb-1">{note.title}</h3>
            <p className="text-[12px] text-text-secondary">{note.content}</p>
            <p className="text-[10px] text-text-faint mt-2">{note.createdAt}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   FLASHCARDS — Tactile study-card interaction
   ═══════════════════════════════════════════ */

function FlashcardsView({ classId }: { classId: string }) {
  const [flashcards, setFlashcards] = useState<FlashcardData[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  const fetchFlashcards = async () => {
    setLoading(true);
    try {
      const data = await generateFlashcards(classId, 10);
      setFlashcards(data.flashcards);
    } catch {
      setFlashcards([
        { front: 'What is the powerhouse of the cell?', back: 'Mitochondria', difficulty: 'easy' },
        { front: 'What is ATP?', back: 'Adenosine triphosphate - energy currency', difficulty: 'easy' },
        { front: 'What is cellular respiration?', back: 'Breaking down glucose for energy', difficulty: 'medium' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchFlashcards(); }, [classId]);

  const currentCard = flashcards[currentIndex];

  return (
    <div className="max-w-lg mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-display-sm text-text-primary">Flashcards</h2>
        <button
          onClick={fetchFlashcards}
          disabled={loading}
          className="btn-accent control flex items-center gap-2 px-4 py-2 text-[13px] font-medium rounded-full disabled:opacity-40"
        >
          {loading ? <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> : <IconRefresh size={14} />}
          {loading ? 'Generating...' : 'Regenerate'}
        </button>
      </div>

      {loading ? (
        <div className="grid place-items-center py-16">
          <div className="w-8 h-8 border-2 border-text-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : flashcards.length > 0 ? (
        <div>
          {/* Card */}
          <motion.div
            key={`${currentIndex}-${isFlipped}`}
            initial={{ rotateY: isFlipped ? -10 : 10, opacity: 0.8 }}
            animate={{ rotateY: 0, opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="surface-elevated grain grain-card p-10 min-h-[240px] flex items-center justify-center text-center cursor-pointer select-none"
            onClick={() => setIsFlipped(!isFlipped)}
          >
            <div>
              <p className="label-micro mb-3">{isFlipped ? 'ANSWER' : 'QUESTION'}</p>
              <p className="text-display-md text-text-primary">
                {isFlipped ? currentCard.back : currentCard.front}
              </p>
              <p className="text-[11px] text-text-faint mt-4">
                Click to {isFlipped ? 'see question' : 'reveal answer'}
              </p>
              {currentCard.difficulty && (
                <div className="mt-3">
                  <Badge tone={currentCard.difficulty === 'easy' ? 'success' : currentCard.difficulty === 'medium' ? 'warning' : 'error'}>
                    {currentCard.difficulty}
                  </Badge>
                </div>
              )}
            </div>
          </motion.div>

          {/* Navigation */}
          <div className="flex items-center justify-between mt-6">
            <button
              onClick={() => { setCurrentIndex(Math.max(0, currentIndex - 1)); setIsFlipped(false); }}
              disabled={currentIndex === 0}
              className="control px-4 py-2 text-[12px] font-medium text-text-secondary hover:text-text-primary border border-[var(--border)] rounded-full disabled:opacity-30"
            >
              Previous
            </button>
            <span className="text-[12px] font-mono text-text-secondary">
              {currentIndex + 1} / {flashcards.length}
            </span>
            <button
              onClick={() => { setCurrentIndex(Math.min(flashcards.length - 1, currentIndex + 1)); setIsFlipped(false); }}
              disabled={currentIndex === flashcards.length - 1}
              className="control px-4 py-2 text-[12px] font-medium text-text-secondary hover:text-text-primary border border-[var(--border)] rounded-full disabled:opacity-30"
            >
              Next
            </button>
          </div>
        </div>
      ) : (
        <div className="text-center py-16">
          <IconFile size={32} className="text-text-faint mx-auto mb-3" />
          <p className="text-[13px] text-text-secondary">No flashcards yet</p>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════
   QUIZ — One-at-a-time premium experience
   ═══════════════════════════════════════════ */

function QuizView({ classId }: { classId: string }) {
  const [quizState, setQuizState] = useState<'idle' | 'taking' | 'completed'>('idle');
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [showExplanation, setShowExplanation] = useState(false);

  const startQuiz = async () => {
    setLoading(true);
    try {
      const data = await generateQuiz(classId, 5);
      setQuestions(data.questions);
      setQuizState('taking');
    } catch {
      setQuestions([
        { question: 'What is the primary function of mitochondria?', options: ['Protein synthesis', 'ATP production', 'Cell division', 'Waste removal'], correct: 1, explanation: 'Mitochondria generate most of the cell\'s ATP supply.' },
        { question: 'Which molecule carries energy within cells?', options: ['DNA', 'RNA', 'ATP', 'Glucose'], correct: 2, explanation: 'ATP is the primary energy currency of cells.' },
      ]);
      setQuizState('taking');
    } finally {
      setLoading(false);
    }
  };

  const handleAnswer = (index: number) => {
    if (selectedAnswer !== null) return;
    setSelectedAnswer(index);
    setShowExplanation(true);
    if (index === questions[currentQuestion].correct) setScore(s => s + 1);
  };

  const nextQuestion = () => {
    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(c => c + 1);
      setSelectedAnswer(null);
      setShowExplanation(false);
    } else {
      setQuizState('completed');
    }
  };

  return (
    <div className="max-w-lg mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-display-sm text-text-primary">Practice Quiz</h2>
        {quizState === 'idle' && (
          <button onClick={startQuiz} disabled={loading} className="btn-accent control flex items-center gap-2 px-4 py-2 text-[13px] font-medium rounded-full disabled:opacity-40">
            {loading ? 'Generating...' : 'Start Quiz'}
          </button>
        )}
      </div>

      {quizState === 'idle' && (
        <div className="text-center py-16">
          <IconCheck size={32} className="text-text-faint mx-auto mb-3" />
          <p className="text-[13px] text-text-secondary">Ready to test your knowledge?</p>
          <p className="text-[12px] text-text-faint mt-1">Adaptive questions from your materials</p>
        </div>
      )}

      {quizState === 'taking' && questions.length > 0 && (
        <div>
          <div className="flex items-center justify-between text-[12px] text-text-secondary mb-3">
            <span>Question {currentQuestion + 1} of {questions.length}</span>
            <span className="font-mono">Score: {score}/{currentQuestion + (selectedAnswer !== null ? 1 : 0)}</span>
          </div>
          <div className="progress-track mb-6">
            <motion.div
              className="h-full rounded-full bg-accent"
              animate={{ width: `${((currentQuestion + 1) / questions.length) * 100}%` }}
              transition={{ duration: 0.4 }}
            />
          </div>

          <div className="surface-elevated p-6">
            <p className="text-display-sm text-text-primary mb-5">
              {questions[currentQuestion].question}
            </p>
            <div className="space-y-2">
              {questions[currentQuestion].options.map((option, i) => {
                const isCorrect = i === questions[currentQuestion].correct;
                const isSelected = i === selectedAnswer;
                const answered = selectedAnswer !== null;

                return (
                  <button
                    key={i}
                    onClick={() => handleAnswer(i)}
                    disabled={answered}
                    className={`w-full p-3.5 text-left rounded-card border transition-all text-[13px] ${
                      !answered
                        ? 'border-[var(--border)] hover:border-[var(--border-strong)] hover:bg-[var(--ink-soft)] text-text-primary'
                        : isCorrect
                          ? 'border-[var(--mastery-mastered)] bg-[var(--success-soft)] text-text-primary'
                          : isSelected
                            ? 'border-[var(--mastery-misconception)] bg-[var(--error-soft)] text-text-primary'
                            : 'border-[var(--border)] opacity-40 text-text-primary'
                    }`}
                  >
                    <span className="font-mono text-[11px] text-text-faint mr-2">{String.fromCharCode(65 + i)}.</span>
                    {option}
                  </button>
                );
              })}
            </div>

            {showExplanation && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="mt-4 p-3 bg-ink-soft rounded-card"
              >
                <p className="text-[12px] text-text-secondary">
                  <strong>Explanation:</strong> {questions[currentQuestion].explanation}
                </p>
              </motion.div>
            )}

            {selectedAnswer !== null && (
              <button
                onClick={nextQuestion}
                className="btn-accent control mt-4 px-4 py-2 text-[13px] font-medium rounded-full"
              >
                {currentQuestion < questions.length - 1 ? 'Next Question' : 'See Results'}
              </button>
            )}
          </div>
        </div>
      )}

      {quizState === 'completed' && (
        <div className="text-center py-16">
          <div className="text-4xl mb-4">{score === questions.length ? '🎉' : '📚'}</div>
          <p className="text-display-sm text-text-primary mb-1">Quiz Complete</p>
          <p className="text-[13px] text-text-secondary mb-4">
            You scored {score} out of {questions.length} ({Math.round((score / questions.length) * 100)}%)
          </p>
          <button
            onClick={() => { setQuizState('idle'); setCurrentQuestion(0); setSelectedAnswer(null); setScore(0); setShowExplanation(false); setQuestions([]); }}
            className="btn-accent control px-4 py-2 text-[13px] font-medium rounded-full"
          >
            Try Again
          </button>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════
   MASTERY — Concept map visualization
   ═══════════════════════════════════════════ */

function MasteryView() {
  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <div className="surface-panel p-6">
        <p className="label-caps mb-4">Knowledge Map</p>
        <LivingKnowledgeField
          sourceName="All sources"
          mastery={0.67}
          practiceScore={{ correct: 23, total: 35 }}
        />
      </div>
      <div className="space-y-4">
        <div className="surface-panel p-4">
          <p className="label-caps mb-3">Concept Breakdown</p>
          <div className="space-y-3">
            {[
              { name: 'Glycolysis', mastery: 0.9 },
              { name: 'Krebs Cycle', mastery: 0.45 },
              { name: 'Electron Transport', mastery: 0.2 },
              { name: 'ATP Synthesis', mastery: 0.7 },
            ].map((concept) => (
              <div key={concept.name}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[12px] text-text-primary">{concept.name}</span>
                  <span className="text-[11px] font-mono text-text-secondary">{Math.round(concept.mastery * 100)}%</span>
                </div>
                <div className="progress-track">
                  <motion.div
                    className="h-full rounded-full"
                    style={{
                      backgroundColor: concept.mastery >= 0.7 ? 'var(--mastery-mastered)' : concept.mastery >= 0.4 ? 'var(--mastery-learning)' : 'var(--mastery-attention)',
                    }}
                    initial={{ width: 0 }}
                    animate={{ width: `${concept.mastery * 100}%` }}
                    transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="surface-panel p-4">
          <p className="label-caps mb-2">Recommendation</p>
          <p className="text-[13px] text-text-secondary leading-relaxed">
            Focus on <strong className="text-text-primary">Electron Transport Chain</strong>, your lowest mastery area. Start with the AI Tutor to build understanding, then quiz yourself.
          </p>
        </div>
      </div>
    </div>
  );
}
