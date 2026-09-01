import { AIMessage, ChatRequest, ChatResponse, QuizQuestion, QuizRequest, QuizResponse, Flashcard, FlashcardRequest, FlashcardResponse, DiagnosticQuestion, DiagnosticRequest, DiagnosticResponse, LearnerProfile } from './types';

// Provider abstraction
export interface AIProvider {
  chat(request: ChatRequest): Promise<ChatResponse>;
  generateQuiz(request: QuizRequest): Promise<QuizResponse>;
  generateFlashcards(request: FlashcardRequest): Promise<FlashcardResponse>;
  runDiagnostic(request: DiagnosticRequest): Promise<DiagnosticResponse>;
  getLearnerProfile(classId: string): Promise<LearnerProfile>;
}

// Demo provider for testing
class DemoProvider implements AIProvider {
  private usage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

  async chat(request: ChatRequest): Promise<ChatResponse> {
    const lastUserMessage = request.messages[request.messages.length - 1]?.content || '';
    
    // Simulate intelligent responses based on context
    let response = '';
    const sources = request.sourceIds?.length ? [
      {
        sourceId: 'src_1',
        sourceName: 'Biology Textbook Chapter 3',
        page: 45,
        excerpt: 'Mitochondria are double-membrane organelles found in most eukaryotic cells...',
        relevance: 0.95
      }
    ] : [];

    if (lastUserMessage.toLowerCase().includes('explain')) {
      response = `Based on your uploaded materials, here's what I can explain:\n\n${lastUserMessage.replace('explain ', '')} is a fundamental concept in your course materials. According to your Biology Textbook (Chapter 3, p.45), this relates to cellular processes that are essential for life.\n\nKey points:\n1. This concept builds on previous knowledge about cell structure\n2. It's directly covered in your uploaded notes\n3. Practice questions are available to test your understanding\n\nWould you like me to create flashcards for this topic or generate some practice questions?`;
    } else if (lastUserMessage.toLowerCase().includes('quiz')) {
      response = `I can create a quiz for you! Based on your uploaded materials, I've identified several key topics that would be good for assessment.\n\nYour recent study patterns suggest focusing on:\n- Cell structure and function\n- Energy production mechanisms\n- Cellular respiration\n\nShall I generate a 5-question quiz on these topics?`;
    } else if (lastUserMessage.toLowerCase().includes('flashcard')) {
      response = `I'll create flashcards from your uploaded materials. I've identified these key terms and concepts:\n\n**Card 1:**\n- Front: What is the powerhouse of the cell?\n- Back: Mitochondria - produces ATP through cellular respiration\n\n**Card 2:**\n- Front: What is the process of converting glucose to ATP?\n- Back: Cellular Respiration - occurs in mitochondria\n\nWould you like me to generate more cards or focus on specific topics?`;
    } else if (lastUserMessage.toLowerCase().includes('note')) {
      response = `I can help you create organized notes from your materials. Here's a summary of what we've covered:\n\n**Key Concepts:**\n- Cellular structure and organelles\n- Energy production pathways\n- Metabolic processes\n\n**Important Definitions:**\n- ATP: Adenosine triphosphate, the cell's energy currency\n- Mitochondria: Organelles that generate most of the cell's ATP\n\n**Study Tips:**\n- Review the diagrams in your textbook\n- Focus on the relationships between organelles\n- Practice with the flashcards I created\n\nWould you like me to expand on any of these sections?`;
    } else {
      response = `I'm your AI study tutor! I can help you with:\n\n**From your uploaded materials:**\n- Explain concepts in simple terms\n- Create study notes and summaries\n- Generate flashcards for key terms\n- Quiz you on important topics\n- Track your learning progress\n\n**What would you like to do?**\n- Ask me to explain a specific concept\n- Request a quiz on your current topic\n- Generate flashcards for review\n- Create study notes from your materials\n\nJust ask, and I'll use your uploaded materials to give you personalized help!`;
    }

    const promptTokens = lastUserMessage.length / 4;
    const completionTokens = response.length / 4;
    this.usage.promptTokens += Math.ceil(promptTokens);
    this.usage.completionTokens += Math.ceil(completionTokens);
    this.usage.totalTokens += Math.ceil(promptTokens + completionTokens);

    return {
      message: {
        role: 'assistant',
        content: response,
        sources
      },
      usage: { ...this.usage }
    };
  }

  async generateQuiz(request: QuizRequest): Promise<QuizResponse> {
    const count = request.count || 5;
    const questions: QuizQuestion[] = [];

    const sampleQuestions = [
      {
        question: 'What is the primary function of mitochondria in a cell?',
        options: [
          'Protein synthesis',
          'ATP production through cellular respiration',
          'Cell division',
          'Waste removal'
        ],
        correctIndex: 1,
        explanation: 'Mitochondria are known as the "powerhouses" of the cell because they generate most of the cell\'s supply of adenosine triphosphate (ATP), used as a source of chemical energy.',
        difficulty: 'easy' as const
      },
      {
        question: 'Which molecule is the primary energy currency of cells?',
        options: [
          'DNA',
          'RNA',
          'ATP',
          'Glucose'
        ],
        correctIndex: 2,
        explanation: 'ATP (adenosine triphosphate) is the primary energy currency of cells, storing and transferring energy for cellular processes.',
        difficulty: 'easy' as const
      },
      {
        question: 'What is the process by which cells break down glucose to produce energy?',
        options: [
          'Photosynthesis',
          'Cellular respiration',
          'Fermentation',
          'Osmosis'
        ],
        correctIndex: 1,
        explanation: 'Cellular respiration is the metabolic process by which cells break down glucose and other organic molecules to produce ATP.',
        difficulty: 'medium' as const
      },
      {
        question: 'Where does the majority of ATP production occur in eukaryotic cells?',
        options: [
          'Nucleus',
          'Ribosomes',
          'Mitochondria',
          'Endoplasmic reticulum'
        ],
        correctIndex: 2,
        explanation: 'The majority of ATP production occurs in mitochondria through oxidative phosphorylation.',
        difficulty: 'medium' as const
      },
      {
        question: 'What is the final electron acceptor in the electron transport chain?',
        options: [
          'Carbon dioxide',
          'Water',
          'Oxygen',
          'Glucose'
        ],
        correctIndex: 2,
        explanation: 'Oxygen is the final electron acceptor in the electron transport chain, combining with electrons and hydrogen ions to form water.',
        difficulty: 'hard' as const
      }
    ];

    for (let i = 0; i < Math.min(count, sampleQuestions.length); i++) {
      questions.push({
        id: `q_${Date.now()}_${i}`,
        ...sampleQuestions[i],
        sourceId: request.sourceIds?.[0]
      });
    }

    return { questions };
  }

  async generateFlashcards(request: FlashcardRequest): Promise<FlashcardResponse> {
    const count = request.count || 10;
    const flashcards: Flashcard[] = [];

    const sampleCards = [
      { front: 'What is the powerhouse of the cell?', back: 'Mitochondria - produces ATP through cellular respiration' },
      { front: 'What is ATP?', back: 'Adenosine triphosphate - the primary energy currency of cells' },
      { front: 'What is cellular respiration?', back: 'The metabolic process by which cells break down glucose to produce ATP' },
      { front: 'What is the electron transport chain?', back: 'A series of protein complexes in mitochondria that generate ATP through oxidative phosphorylation' },
      { front: 'What is the role of oxygen in cellular respiration?', back: 'Oxygen acts as the final electron acceptor in the electron transport chain' },
      { front: 'What is glycolysis?', back: 'The first step of cellular respiration, breaking down glucose into pyruvate' },
      { front: 'What is the Krebs cycle?', back: 'A series of chemical reactions that generate energy through the oxidation of acetyl-CoA' },
      { front: 'What is oxidative phosphorylation?', back: 'The process of generating ATP using energy from the electron transport chain' },
      { front: 'What is the difference between aerobic and anaerobic respiration?', back: 'Aerobic uses oxygen, anaerobic does not; aerobic produces more ATP' },
      { front: 'What are the products of cellular respiration?', back: 'ATP, carbon dioxide, and water' }
    ];

    for (let i = 0; i < Math.min(count, sampleCards.length); i++) {
      flashcards.push({
        id: `fc_${Date.now()}_${i}`,
        ...sampleCards[i],
        sourceId: request.sourceIds?.[0],
        difficulty: i < 3 ? 'easy' : i < 7 ? 'medium' : 'hard',
        nextReview: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        interval: 1,
        easeFactor: 2.5
      });
    }

    return { flashcards };
  }

  async runDiagnostic(request: DiagnosticRequest): Promise<DiagnosticResponse> {
    const questions: DiagnosticQuestion[] = [
      {
        id: `dq_${Date.now()}_1`,
        question: 'Which organelle is known as the "powerhouse of the cell"?',
        options: ['Nucleus', 'Mitochondria', 'Ribosome', 'Golgi apparatus'],
        correctIndex: 1,
        topic: 'Cell Structure'
      },
      {
        id: `dq_${Date.now()}_2`,
        question: 'What is the primary function of mitochondria?',
        options: [
          'Protein synthesis',
          'ATP production',
          'Cell division',
          'DNA replication'
        ],
        correctIndex: 1,
        topic: 'Cellular Energy'
      },
      {
        id: `dq_${Date.now()}_3`,
        question: 'What molecule carries energy within cells?',
        options: ['DNA', 'RNA', 'ATP', 'Glucose'],
        correctIndex: 2,
        topic: 'Cellular Energy'
      }
    ];

    return { questions };
  }

  async getLearnerProfile(classId: string): Promise<LearnerProfile> {
    return {
      classId,
      strengths: ['Cell structure', 'Basic terminology'],
      weaknesses: ['Metabolic pathways', 'Electron transport chain'],
      masteryLevel: 0.45,
      studyRecommendation: 'Focus on understanding the electron transport chain and its role in cellular respiration. Review the diagrams in your textbook and practice with flashcards.',
      lastUpdated: new Date().toISOString()
    };
  }
}

// OpenAI provider (placeholder for real implementation)
class OpenAIProvider implements AIProvider {
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model: string = 'gpt-4') {
    this.apiKey = apiKey;
    this.model = model;
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    // TODO: Implement real OpenAI API call
    throw new Error('OpenAI provider not yet implemented');
  }

  async generateQuiz(request: QuizRequest): Promise<QuizResponse> {
    throw new Error('OpenAI provider not yet implemented');
  }

  async generateFlashcards(request: FlashcardRequest): Promise<FlashcardResponse> {
    throw new Error('OpenAI provider not yet implemented');
  }

  async runDiagnostic(request: DiagnosticRequest): Promise<DiagnosticResponse> {
    throw new Error('OpenAI provider not yet implemented');
  }

  async getLearnerProfile(classId: string): Promise<LearnerProfile> {
    throw new Error('OpenAI provider not yet implemented');
  }
}

// Factory
let provider: AIProvider | null = null;

export function getAIProvider(): AIProvider {
  if (!provider) {
    const apiKey = process.env.NEXT_PUBLIC_AI_API_KEY;
    const providerType = process.env.NEXT_PUBLIC_AI_PROVIDER || 'demo';
    
    if (providerType === 'openai' && apiKey) {
      provider = new OpenAIProvider(apiKey);
    } else {
      provider = new DemoProvider();
    }
  }
  return provider;
}

export function resetProvider(): void {
  provider = null;
}
