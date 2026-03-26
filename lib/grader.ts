export interface QuestionRecord {
  id:                string;
  topic:             string;
  questionType:      string;
  correctAnswer:     string;
  studentAnswer:     string | null;  // MCQ/TF: A/B/C/D or True/False
  studentAnswerText: string | null;  // fill_blank/code: free text
  marks:             number;
  aiScore:           number | null;  // AI-given score for fill_blank/code
}

export interface GradeResult {
  score:          number;
  totalMarks:     number;
  percentage:     number;
  passed:         boolean;
  passScore:      number;
  topicBreakdown: Record<string, { correct: number; total: number; marks: number }>;
}

export function gradeExam(questions: QuestionRecord[], configTotalMarks?: number): GradeResult {
  const topicBreakdown: Record<string, { correct: number; total: number; marks: number }> = {};
  let score = 0;

  for (const q of questions) {
    if (!topicBreakdown[q.topic]) topicBreakdown[q.topic] = { correct: 0, total: 0, marks: 0 };
    const bucket = topicBreakdown[q.topic];
    bucket.total += 1;

    const qtype = q.questionType ?? "mcq";

    if (qtype === "mcq" || qtype === "true_false") {
      // Auto-graded: exact match
      const correct = q.studentAnswer && q.studentAnswer === q.correctAnswer;
      if (correct) {
        score += q.marks;
        bucket.correct += 1;
        bucket.marks   += q.marks;
      }
    } else {
      // fill_blank / code: use AI score if available
      if (q.aiScore !== null && q.aiScore > 0) {
        score += q.aiScore;
        bucket.marks += q.aiScore;
        if (q.aiScore >= q.marks) bucket.correct += 1;
      }
    }
  }

  const totalMarks  = configTotalMarks ?? questions.reduce((s, q) => s + q.marks, 0);
  const percentage  = totalMarks > 0 ? Math.round((score / totalMarks) * 100) : 0;
  const passScore   = Math.ceil(totalMarks * 0.5);

  return {
    score,
    totalMarks,
    percentage,
    passed:    score >= passScore,
    passScore,
    topicBreakdown,
  };
}
