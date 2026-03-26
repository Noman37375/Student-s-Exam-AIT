export type AnswerOption  = "A" | "B" | "C" | "D";
export type QuestionType  = "mcq" | "true_false" | "fill_blank" | "code";

export interface ExamQuestion {
  id:           string;
  topic:        string;
  question:     string;
  questionType: QuestionType;
  marks:        number;
  optionA:      string;
  optionB:      string;
  optionC:      string;
  optionD:      string;
  orderIndex:   number;
}

export interface ExamSession {
  sessionId:       string;
  studentName:     string;
  studentId:       string;
  questions:       ExamQuestion[];
  durationMinutes: number;
  totalMarks:      number;
}

export interface SubmitPayload {
  sessionId: string;
  answers:   Record<string, string>;   // questionId → answer text (A/B/C/D or free text)
}

export interface ExamResultQuestion extends ExamQuestion {
  correctAnswer:     string;
  modelAnswer:       string | null;
  studentAnswer:     string | null;
  studentAnswerText: string | null;
  aiScore:           number | null;
  isCorrect:         boolean;
  earnedMarks:       number;
}

export interface TopicStats {
  correct:    number;
  total:      number;
  marks:      number;
  percentage: number;
}

export interface ExamResult {
  sessionId:      string;
  studentName:    string;
  studentId:      string | null;
  score:          number;
  totalMarks:     number;
  percentage:     number;
  passed:         boolean;
  passScore:      number;
  submittedAt:    string;
  topicBreakdown: Record<string, TopicStats>;
  questions:      ExamResultQuestion[];
}
