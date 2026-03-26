export type TopicKey = "Python Fundamentals" | "Basic OOP" | "Basic Gen AI & Tools";
export type AnswerOption = "A" | "B" | "C" | "D";

export interface ExamQuestion {
  id: string;
  topic: TopicKey;
  question: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  orderIndex: number;
}

export interface ExamSession {
  sessionId: string;
  studentName: string;
  studentId: string;
  questions: ExamQuestion[];
  durationMinutes: number;
}

export interface SubmitPayload {
  sessionId: string;
  answers: Record<string, AnswerOption>;
}

export interface ExamResultQuestion extends ExamQuestion {
  correctAnswer: AnswerOption;
  studentAnswer: AnswerOption | null;
  isCorrect: boolean;
}

export interface TopicStats {
  correct: number;
  total: number;
  marks: number;
  percentage: number;
}

export interface ExamResult {
  sessionId: string;
  studentName: string;
  studentId: string | null;
  score: number;
  totalMarks: number;
  percentage: number;
  passed: boolean;
  submittedAt: string;
  topicBreakdown: Record<TopicKey, TopicStats>;
  questions: ExamResultQuestion[];
}
