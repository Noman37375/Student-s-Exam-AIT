export const MARKS_PER_QUESTION = 2;
export const TOTAL_MARKS = 80;

export interface GradeResult {
  score: number;
  totalMarks: number;
  percentage: number;
  passed: boolean;
  topicBreakdown: Record<string, { correct: number; total: number; marks: number }>;
}

export interface AnswerInput {
  questionId: string;
  answer: "A" | "B" | "C" | "D" | null;
}

export interface QuestionRecord {
  id: string;
  topic: string;
  correctAnswer: string;
  studentAnswer: string | null;
}

export function gradeExam(questions: QuestionRecord[]): GradeResult {
  const topicBreakdown: Record<string, { correct: number; total: number; marks: number }> = {};

  let score = 0;

  for (const q of questions) {
    if (!topicBreakdown[q.topic]) {
      topicBreakdown[q.topic] = { correct: 0, total: 0, marks: 0 };
    }
    const bucket = topicBreakdown[q.topic];
    bucket.total += 1;

    if (q.studentAnswer && q.studentAnswer === q.correctAnswer) {
      score += MARKS_PER_QUESTION;
      bucket.correct += 1;
      bucket.marks += MARKS_PER_QUESTION;
    }
  }

  return {
    score,
    totalMarks: TOTAL_MARKS,
    percentage: Math.round((score / TOTAL_MARKS) * 100),
    passed: score >= 25,
    topicBreakdown,
  };
}
