export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  sources?: SourceCitation[];
}

export interface SourceCitation {
  sourceId: string;
  sourceName: string;
  page?: number;
  excerpt: string;
  relevance: number;
}

export interface ChatRequest {
  messages: AIMessage[];
  classId: string;
  sourceIds?: string[];
  systemPrompt?: string;
}

export interface ChatResponse {
  message: AIMessage;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  sourceId?: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

export interface QuizRequest {
  classId: string;
  sourceIds?: string[];
  topic?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  count?: number;
}

export interface QuizResponse {
  questions: QuizQuestion[];
}

export interface Flashcard {
  id: string;
  front: string;
  back: string;
  sourceId?: string;
  difficulty: 'easy' | 'medium' | 'hard';
  nextReview: string;
  interval: number;
  easeFactor: number;
}

export interface FlashcardRequest {
  classId: string;
  sourceIds?: string[];
  count?: number;
}

export interface FlashcardResponse {
  flashcards: Flashcard[];
}

export interface DiagnosticRequest {
  classId: string;
  sourceIds?: string[];
}

export interface DiagnosticQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  topic: string;
}

export interface DiagnosticResponse {
  questions: DiagnosticQuestion[];
}

export interface LearnerProfile {
  classId: string;
  strengths: string[];
  weaknesses: string[];
  masteryLevel: number;
  studyRecommendation: string;
  lastUpdated: string;
}
