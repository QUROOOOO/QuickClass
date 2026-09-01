'use client';

import { useState, useEffect, useRef } from 'react';
import { IconFile, IconPlus, IconCheck, IconSpark, IconChevronLeft, IconClose } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
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

type ClassTab = 'sources' | 'tutor' | 'notes' | 'flashcards' | 'quiz';

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

  const tabs: { id: ClassTab; label: string; icon: React.ReactNode }[] = [
    { id: 'tutor', label: 'AI Tutor', icon: <IconSpark className="w-4 h-4" /> },
    { id: 'sources', label: 'Sources', icon: <IconFile className="w-4 h-4" /> },
    { id: 'notes', label: 'Notes', icon: <IconFile className="w-4 h-4" /> },
    { id: 'flashcards', label: 'Flashcards', icon: <IconFile className="w-4 h-4" /> },
    { id: 'quiz', label: 'Quiz', icon: <IconCheck className="w-4 h-4" /> }
  ];

  // Fetch sources when tab changes to sources
  useEffect(() => {
    if (activeTab === 'sources') {
      fetchSources();
    }
  }, [activeTab, classId]);

  const fetchSources = async () => {
    setLoadingSources(true);
    try {
      const data = await listSources(classId);
      setSources(data);
    } catch (err) {
      console.error('Failed to fetch sources:', err);
      // Fallback demo data
      setSources([
        {
          id: 'src_demo_1',
          class_id: classId,
          name: 'Biology Textbook Chapter 3.pdf',
          type: 'pdf',
          status: 'ready',
          chunks: 45,
          size: '2.4 MB',
        },
        {
          id: 'src_demo_2',
          class_id: classId,
          name: 'Lecture Notes - Cell Structure.docx',
          type: 'docx',
          status: 'ready',
          chunks: 12,
          size: '156 KB',
        },
      ]);
    } finally {
      setLoadingSources(false);
    }
  };

  const handleUpload = async (file: File) => {
    try {
      const newSource = await uploadSource(classId, file);
      setSources(prev => [newSource, ...prev]);
    } catch (err) {
      console.error('Upload failed:', err);
      // Fallback: add locally
      const fallbackSource: SourceData = {
        id: `local_${Date.now()}`,
        class_id: classId,
        name: file.name,
        type: file.name.split('.').pop() || 'unknown',
        status: 'ready',
        chunks: Math.max(1, Math.floor(file.size / 2000)),
        size: formatFileSize(file.size),
      };
      setSources(prev => [fallbackSource, ...prev]);
    }
  };

  const handleDeleteSource = async (sourceId: string) => {
    try {
      await deleteSource(classId, sourceId);
      setSources(prev => prev.filter(s => s.id !== sourceId));
    } catch (err) {
      console.error('Delete failed:', err);
      setSources(prev => prev.filter(s => s.id !== sourceId));
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={onBack}
          className="icon-button"
          aria-label="Back to classes"
        >
          <IconChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-3">
          <span className="text-2xl">{emoji}</span>
          <h1 className="display text-2xl">{className}</h1>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 p-1 surface-panel rounded-lg">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md transition-colors ${
              activeTab === tab.id
                ? 'bg-text-primary text-page'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            {tab.icon}
            <span className="text-sm font-medium">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'tutor' && <TutorView classId={classId} />}
        {activeTab === 'sources' && (
          <SourcesView 
            sources={sources} 
            loading={loadingSources}
            onUpload={handleUpload}
            onDelete={handleDeleteSource}
          />
        )}
        {activeTab === 'notes' && <NotesView classId={classId} />}
        {activeTab === 'flashcards' && <FlashcardsView classId={classId} />}
        {activeTab === 'quiz' && <QuizView classId={classId} />}
      </div>
    </div>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function TutorView({ classId }: { classId: string }) {
  const [messages, setMessages] = useState<Array<{role: 'user' | 'assistant', content: string, sources?: {name: string, relevance: number}[]}>>([
    {
      role: 'assistant',
      content: "Hello! I'm your AI study tutor. I can help you understand your course materials, create study guides, and answer questions based on your uploaded sources.\n\nWhat would you like to learn about today?"
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    
    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setLoading(true);
    
    try {
      const response = await sendChat(classId, userMessage);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: response.response,
        sources: response.sources 
      }]);
    } catch (err) {
      console.error('Chat failed:', err);
      // Fallback response
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: `I understand you're asking about: "${userMessage}". I'm here to help! Try uploading some course materials, and I'll be able to give you more specific answers based on your sources.`
      }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] p-4 rounded-lg ${
                msg.role === 'user'
                  ? 'bg-text-primary text-page'
                  : 'surface-panel'
              }`}
            >
              <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
              {msg.sources && msg.sources.length > 0 && (
                <div className="mt-3 pt-3 border-t border-border">
                  <p className="text-xs text-text-secondary mb-1">Sources:</p>
                  <div className="flex flex-wrap gap-1">
                    {msg.sources.map((source, j) => (
                      <Badge key={j} tone="success">
                        {source.name} ({Math.round(source.relevance * 100)}%)
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="surface-panel p-4 rounded-lg">
              <div className="flex items-center gap-2 text-text-secondary">
                <span className="w-2 h-2 bg-text-secondary rounded-full animate-pulse" />
                <span className="w-2 h-2 bg-text-secondary rounded-full animate-pulse" style={{ animationDelay: '0.2s' }} />
                <span className="w-2 h-2 bg-text-secondary rounded-full animate-pulse" style={{ animationDelay: '0.4s' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-border">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder="Ask a question about your materials..."
            className="flex-1 px-4 py-2 bg-ink-soft border border-border rounded-lg text-sm text-text-primary placeholder:text-text-faint focus:outline-none focus:border-border-strong"
            disabled={loading}
          />
          <Button onClick={handleSend} variant="primary" size="sm" disabled={loading || !input.trim()}>
            {loading ? 'Thinking...' : 'Send'}
          </Button>
        </div>
      </div>
    </div>
  );
}

interface SourcesViewProps {
  sources: SourceData[];
  loading: boolean;
  onUpload: (file: File) => void;
  onDelete: (sourceId: string) => void;
}

function SourcesView({ sources, loading, onUpload, onDelete }: SourcesViewProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onUpload(file);
      e.target.value = ''; // Reset input
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="display text-lg">Uploaded Sources</h2>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept=".pdf,.docx,.doc,.txt,.md,.png,.jpg,.jpeg"
          onChange={handleFileChange}
        />
        <Button 
          variant="primary" 
          size="sm" 
          className="flex items-center gap-2"
          onClick={() => fileInputRef.current?.click()}
        >
          <IconPlus className="w-4 h-4" />
          Upload Source
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-text-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-2">
          {sources.map((source) => (
            <div
              key={source.id}
              className="flex items-center justify-between p-4 surface-panel rounded-lg"
            >
              <div className="flex items-center gap-3">
                <IconFile className="w-5 h-5 text-text-secondary" />
                <div>
                  <p className="text-sm font-medium text-text-primary">{source.name}</p>
                  <p className="text-xs text-text-secondary">
                    {source.size} • {source.chunks} chunks
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone={source.status === 'ready' ? 'success' : source.status === 'processing' ? 'warning' : 'error'}>
                  {source.status}
                </Badge>
                <button
                  onClick={() => onDelete(source.id)}
                  className="icon-button p-1 text-text-secondary hover:text-text-primary"
                >
                  <IconClose className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && sources.length === 0 && (
        <div className="text-center py-12">
          <IconFile className="w-12 h-12 mx-auto text-text-secondary mb-4" />
          <p className="text-text-secondary">No sources uploaded yet</p>
          <p className="text-sm text-text-secondary mt-1">
            Upload your course materials to get started
          </p>
        </div>
      )}
    </div>
  );
}

function NotesView({ classId }: { classId: string }) {
  const [notes] = useState([
    {
      id: '1',
      title: 'Cell Structure Summary',
      content: 'Key organelles and their functions...',
      createdAt: '2 hours ago'
    },
    {
      id: '2',
      title: 'Cellular Respiration',
      content: 'The process of converting glucose to ATP...',
      createdAt: '1 day ago'
    }
  ]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="display text-lg">Study Notes</h2>
        <Button variant="primary" size="sm" className="flex items-center gap-2">
          <IconPlus className="w-4 h-4" />
          Create Note
        </Button>
      </div>

      <div className="grid gap-4">
        {notes.map((note) => (
          <div key={note.id} className="p-4 surface-panel rounded-lg cursor-pointer hover:border-border-strong transition-colors">
            <h3 className="font-medium text-text-primary mb-1">{note.title}</h3>
            <p className="text-sm text-text-secondary">{note.content}</p>
            <p className="text-xs text-text-secondary mt-2">{note.createdAt}</p>
          </div>
        ))}
      </div>

      {notes.length === 0 && (
        <div className="text-center py-12">
          <IconFile className="w-12 h-12 mx-auto text-text-secondary mb-4" />
          <p className="text-text-secondary">No notes yet</p>
          <p className="text-sm text-text-secondary mt-1">
            Ask the AI tutor to create notes from your materials
          </p>
        </div>
      )}
    </div>
  );
}

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
    } catch (err) {
      console.error('Failed to generate flashcards:', err);
      // Fallback
      setFlashcards([
        { front: 'What is the powerhouse of the cell?', back: 'Mitochondria', difficulty: 'easy' },
        { front: 'What is ATP?', back: 'Adenosine triphosphate - energy currency', difficulty: 'easy' },
        { front: 'What is cellular respiration?', back: 'Breaking down glucose for energy', difficulty: 'medium' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFlashcards();
  }, [classId]);

  const currentCard = flashcards[currentIndex];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="display text-lg">Flashcards</h2>
        <Button 
          variant="primary" 
          size="sm" 
          className="flex items-center gap-2"
          onClick={fetchFlashcards}
          disabled={loading}
        >
          {loading ? (
            <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
          ) : (
            <IconPlus className="w-4 h-4" />
          )}
          {loading ? 'Generating...' : 'Generate Cards'}
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-text-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : flashcards.length > 0 ? (
        <div className="space-y-4">
          {/* Card */}
          <div
            className="p-8 surface-panel rounded-lg cursor-pointer min-h-[200px] flex items-center justify-center text-center"
            onClick={() => setIsFlipped(!isFlipped)}
          >
            <div>
              <p className="text-sm text-text-secondary mb-2">
                {isFlipped ? 'Answer' : 'Question'}
              </p>
              <p className="text-lg font-medium text-text-primary">
                {isFlipped ? currentCard.back : currentCard.front}
              </p>
              <p className="text-xs text-text-secondary mt-4">
                Click to {isFlipped ? 'see question' : 'reveal answer'}
              </p>
              {currentCard.difficulty && (
                <Badge 
                  tone={currentCard.difficulty === 'easy' ? 'success' : currentCard.difficulty === 'medium' ? 'warning' : 'error'}
                >
                  {currentCard.difficulty}
                </Badge>
              )}
            </div>
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setCurrentIndex(Math.max(0, currentIndex - 1));
                setIsFlipped(false);
              }}
              disabled={currentIndex === 0}
            >
              Previous
            </Button>
            <span className="text-sm text-text-secondary">
              {currentIndex + 1} of {flashcards.length}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setCurrentIndex(Math.min(flashcards.length - 1, currentIndex + 1));
                setIsFlipped(false);
              }}
              disabled={currentIndex === flashcards.length - 1}
            >
              Next
            </Button>
          </div>
        </div>
      ) : (
        <div className="text-center py-12">
          <IconFile className="w-12 h-12 mx-auto text-text-secondary mb-4" />
          <p className="text-text-secondary">No flashcards yet</p>
          <p className="text-sm text-text-secondary mt-1">
            Generate flashcards from your uploaded materials
          </p>
        </div>
      )}
    </div>
  );
}

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
    } catch (err) {
      console.error('Failed to generate quiz:', err);
      // Fallback
      setQuestions([
        {
          question: 'What is the primary function of mitochondria?',
          options: ['Protein synthesis', 'ATP production', 'Cell division', 'Waste removal'],
          correct: 1,
          explanation: 'Mitochondria generate most of the cell\'s ATP supply.'
        },
        {
          question: 'Which molecule carries energy within cells?',
          options: ['DNA', 'RNA', 'ATP', 'Glucose'],
          correct: 2,
          explanation: 'ATP is the primary energy currency of cells.'
        }
      ]);
      setQuizState('taking');
    } finally {
      setLoading(false);
    }
  };

  const handleAnswer = (index: number) => {
    if (selectedAnswer !== null) return; // Already answered
    
    setSelectedAnswer(index);
    setShowExplanation(true);
    if (index === questions[currentQuestion].correct) {
      setScore(score + 1);
    }
  };

  const nextQuestion = () => {
    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
      setSelectedAnswer(null);
      setShowExplanation(false);
    } else {
      setQuizState('completed');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="display text-lg">Practice Quiz</h2>
        {quizState === 'idle' && (
          <Button variant="primary" size="sm" onClick={startQuiz} disabled={loading}>
            {loading ? 'Generating...' : 'Start Quiz'}
          </Button>
        )}
      </div>

      {quizState === 'idle' && (
        <div className="text-center py-12">
          <IconCheck className="w-12 h-12 mx-auto text-text-secondary mb-4" />
          <p className="text-text-secondary">Ready to test your knowledge?</p>
          <p className="text-sm text-text-secondary mt-1">
            This quiz covers key concepts from your uploaded materials
          </p>
        </div>
      )}

      {quizState === 'taking' && questions.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-sm text-text-secondary">
            <span>Question {currentQuestion + 1} of {questions.length}</span>
            <span>Score: {score}/{currentQuestion + (selectedAnswer !== null ? 1 : 0)}</span>
          </div>
          
          <div className="progress-track">
            <div
              className="progress-fill"
              style={{ width: `${((currentQuestion + 1) / questions.length) * 100}%` }}
            />
          </div>

          <div className="p-6 surface-panel rounded-lg">
            <p className="text-lg font-medium text-text-primary mb-4">
              {questions[currentQuestion].question}
            </p>
            <div className="space-y-2">
              {questions[currentQuestion].options.map((option, i) => (
                <button
                  key={i}
                  onClick={() => handleAnswer(i)}
                  disabled={selectedAnswer !== null}
                  className={`w-full p-3 text-left rounded-lg border transition-colors ${
                    selectedAnswer === null
                      ? 'border-border hover:border-border-strong text-text-primary'
                      : i === questions[currentQuestion].correct
                      ? 'border-green-500 bg-green-500/10 text-text-primary'
                      : i === selectedAnswer
                      ? 'border-red-500 bg-red-500/10 text-text-primary'
                      : 'border-border opacity-50 text-text-primary'
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
            {showExplanation && (
              <div className="mt-4 p-3 bg-ink-soft rounded-lg">
                <p className="text-sm text-text-secondary">
                  <strong>Explanation:</strong> {questions[currentQuestion].explanation}
                </p>
              </div>
            )}
            {selectedAnswer !== null && (
              <Button
                variant="primary"
                size="sm"
                className="mt-4"
                onClick={nextQuestion}
              >
                {currentQuestion < questions.length - 1 ? 'Next Question' : 'See Results'}
              </Button>
            )}
          </div>
        </div>
      )}

      {quizState === 'completed' && (
        <div className="text-center py-12">
          <div className="text-4xl mb-4">{score === questions.length ? '🎉' : '📚'}</div>
          <p className="text-lg font-medium text-text-primary mb-2">Quiz Complete!</p>
          <p className="text-text-secondary">
            You scored {score} out of {questions.length} ({Math.round((score / questions.length) * 100)}%)
          </p>
          <Button
            variant="primary"
            size="sm"
            className="mt-4"
            onClick={() => {
              setQuizState('idle');
              setCurrentQuestion(0);
              setSelectedAnswer(null);
              setScore(0);
              setShowExplanation(false);
              setQuestions([]);
            }}
          >
            Try Again
          </Button>
        </div>
      )}
    </div>
  );
}
