import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { gradeExam } from "@/lib/grader";
import type { TopicKey } from "@/types/exam";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;

    const session = await db.query.examSessions.findFirst({
      where: (s, { eq }) => eq(s.id, sessionId),
    });

    if (!session) {
      return NextResponse.json({ error: "Session not found." }, { status: 404 });
    }
    if (session.status === "in_progress") {
      return NextResponse.json({ error: "Exam not yet submitted." }, { status: 403 });
    }

    const questions = await db.query.examQuestions.findMany({
      where: (q, { eq }) => eq(q.sessionId, sessionId),
      orderBy: (q, { asc }) => [asc(q.orderIndex)],
    });

    const gradingInput = questions.map((q) => ({
      id:            q.id,
      topic:         q.topic,
      correctAnswer: q.correctAnswer!,
      studentAnswer: q.studentAnswer ?? null,
    }));

    const graded = gradeExam(gradingInput);

    const topicBreakdown = Object.fromEntries(
      Object.entries(graded.topicBreakdown).map(([topic, stats]) => [
        topic,
        {
          ...stats,
          percentage: stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0,
        },
      ])
    );

    const resultQuestions = questions.map((q) => ({
      id:            q.id,
      topic:         q.topic as TopicKey,
      question:      q.question,
      optionA:       q.optionA,
      optionB:       q.optionB,
      optionC:       q.optionC,
      optionD:       q.optionD,
      orderIndex:    q.orderIndex,
      correctAnswer: q.correctAnswer,
      studentAnswer: q.studentAnswer ?? null,
      isCorrect:     q.studentAnswer === q.correctAnswer,
    }));

    return NextResponse.json({
      sessionId,
      studentName:    session.studentName,
      studentId:      session.studentId,
      score:          graded.score,
      totalMarks:     graded.totalMarks,
      percentage:     graded.percentage,
      passed:         graded.passed,
      submittedAt:    session.submittedAt?.toISOString(),
      topicBreakdown,
      questions:      resultQuestions,
    });
  } catch (err) {
    console.error("[/api/exam/result]", err);
    return NextResponse.json({ error: "Failed to fetch result." }, { status: 500 });
  }
}
