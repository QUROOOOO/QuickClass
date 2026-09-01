const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface APIError {
  detail: string;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const error: APIError = await res.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || `API error ${res.status}`);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

// Classes
export interface ClassData {
  id: string;
  name: string;
  emoji: string;
  description: string;
  sources: number;
  progress: number;
}

export async function listClasses(): Promise<ClassData[]> {
  return request<ClassData[]>('/api/v1/classes');
}

export async function createClass(data: { name: string; emoji: string; description: string }): Promise<ClassData> {
  return request<ClassData>('/api/v1/classes', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function getClass(classId: string): Promise<ClassData> {
  return request<ClassData>(`/api/v1/classes/${classId}`);
}

export async function deleteClass(classId: string): Promise<void> {
  return request<void>(`/api/v1/classes/${classId}`, { method: 'DELETE' });
}

// Sources
export interface SourceData {
  id: string;
  class_id: string;
  name: string;
  type: string;
  status: string;
  chunks: number;
  size: string;
}

export async function listSources(classId: string): Promise<SourceData[]> {
  return request<SourceData[]>(`/api/v1/classes/${classId}/sources`);
}

export async function uploadSource(classId: string, file: File): Promise<SourceData> {
  const formData = new FormData();
  formData.append('file', file);

  const url = `${API_BASE}/api/v1/classes/${classId}/sources/upload`;
  const res = await fetch(url, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const error: APIError = await res.json().catch(() => ({ detail: 'Upload failed' }));
    throw new Error(error.detail || `Upload error ${res.status}`);
  }

  return res.json();
}

export async function deleteSource(classId: string, sourceId: string): Promise<void> {
  return request<void>(`/api/v1/classes/${classId}/sources/${sourceId}`, { method: 'DELETE' });
}

// Chat
export interface ChatResponse {
  response: string;
  sources: { name: string; relevance: number }[];
}

export async function sendChat(classId: string, message: string): Promise<ChatResponse> {
  return request<ChatResponse>('/api/v1/chat', {
    method: 'POST',
    body: JSON.stringify({ class_id: classId, message }),
  });
}

// Quiz
export interface QuizQuestion {
  question: string;
  options: string[];
  correct: number;
  explanation: string;
}

export async function generateQuiz(classId: string, count?: number, topic?: string): Promise<{ questions: QuizQuestion[] }> {
  return request<{ questions: QuizQuestion[] }>('/api/v1/quiz', {
    method: 'POST',
    body: JSON.stringify({ class_id: classId, count: count || 5, topic: topic || '' }),
  });
}

// Flashcards
export interface FlashcardData {
  front: string;
  back: string;
  difficulty: string;
}

export async function generateFlashcards(classId: string, count?: number): Promise<{ flashcards: FlashcardData[] }> {
  return request<{ flashcards: FlashcardData[] }>('/api/v1/flashcards', {
    method: 'POST',
    body: JSON.stringify({ class_id: classId, count: count || 10 }),
  });
}

// Diagnostic
export interface DiagnosticQuestion {
  question: string;
  options: string[];
  correct: number;
  topic: string;
}

export async function runDiagnostic(classId: string): Promise<{ questions: DiagnosticQuestion[] }> {
  return request<{ questions: DiagnosticQuestion[] }>('/api/v1/diagnostic', {
    method: 'POST',
    body: JSON.stringify({ class_id: classId }),
  });
}

// Learner Profile
export interface LearnerProfile {
  class_id: string;
  strengths: string[];
  weaknesses: string[];
  mastery_level: number;
  study_recommendation: string;
  total_quizzes_taken: number;
  average_score: number;
  total_study_time_minutes: number;
  last_updated: string;
}

export async function getLearnerProfile(classId: string): Promise<LearnerProfile> {
  return request<LearnerProfile>(`/api/v1/classes/${classId}/profile`);
}
