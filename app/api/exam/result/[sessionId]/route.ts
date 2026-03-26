import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { gradeExam } from "@/lib/grader";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;

    const session = await db.query.examSessions.findFirst({
      where: (s, { eq }) => eq(s.id, sessionId),
    });
    if (!session)                        return NextResponse.json({ error: "Session not found." }, { status: 404 });
    if (session.status === "in_progress") return NextResponse.json({ error: "Exam not yet submitted." }, { status: 403 });

    const questions = await db.query.examQuestions.findMany({
      where: (q, { eq }) => eq(q.sessionId, sessionId),
      orderBy: (q, { asc }) => [asc(q.orderIndex)],
    });

    const gradingInput = questions.map((q) => ({
      id:                q.id,
      topic:             q.topic,
      questionType:      q.questionType ?? "mcq",
      correctAnswer:     q.correctAnswer ?? "",
      studentAnswer:     q.studentAnswer ?? null,
      studentAnswerText: q.studentAnswerText ?? null,
      marks:             q.marks ?? 2,
      aiScore:           q.aiScore ?? null,
    }));

    const graded = gradeExam(gradingInput, session.totalMarks);

    const topicBreakdown = Object.fromEntries(
      Object.entries(graded.topicBreakdown).map(([topic, stats]) => [
        topic,
        { ...stats, percentage: stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0 },
      ])
    );

    const resultQuestions = questions.map((q) => {
      const qtype = q.questionType ?? "mcq";
      const isAutoGraded = qtype === "mcq" || qtype === "true_false";
      const isCorrect    = isAutoGraded
        ? (q.studentAnswer ?? null) === q.correctAnswer
        : (q.aiScore ?? 0) >= q.marks;
      const earnedMarks  = isAutoGraded
        ? (isCorrect ? (q.marks ?? 2) : 0)
        : (q.aiScore ?? 0);

      return {
        id:                q.id,
        topic:             q.topic,
        question:          q.question,
        questionType:      qtype,
        marks:             q.marks ?? 2,
        optionA:           q.optionA,
        optionB:           q.optionB,
        optionC:           q.optionC,
        optionD:           q.optionD,
        orderIndex:        q.orderIndex,
        correctAnswer:     q.correctAnswer ?? "",
        modelAnswer:       q.modelAnswer   ?? null,
        studentAnswer:     q.studentAnswer ?? null,
        studentAnswerText: q.studentAnswerText ?? null,
        aiScore:           q.aiScore ?? null,
        isCorrect,
        earnedMarks,
      };
    });

    return NextResponse.json({
      sessionId,
      studentName:    session.studentName,
      studentId:      session.studentId,
      score:          graded.score,
      totalMarks:     graded.totalMarks,
      percentage:     graded.percentage,
      passed:         graded.passed,
      passScore:      graded.passScore,
      submittedAt:    session.submittedAt?.toISOString(),
      topicBreakdown,
      questions:      resultQuestions,
    });
  } catch (err) {
    console.error("[/api/exam/result]", err);
    return NextResponse.json({ error: "Failed to fetch result." }, { status: 500 });
  }
}
