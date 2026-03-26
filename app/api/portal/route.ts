import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { gradeExam } from "@/lib/grader";
import type { TopicKey } from "@/types/exam";

const Schema = z.object({ studentId: z.string().min(1).trim().toUpperCase() });

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { studentId } = Schema.parse(body);

    const session = await db.query.examSessions.findFirst({
      where: (s, { eq, and }) =>
        and(eq(s.studentId, studentId), eq(s.status, "submitted")),
      orderBy: (s, { desc }) => [desc(s.submittedAt)],
    });

    if (!session) {
      return NextResponse.json({ error: "No submitted exam found for this Student ID." }, { status: 404 });
    }

    if (!session.resultVisible) {
      return NextResponse.json({ announced: false, studentName: session.studentName });
    }

    const questions = await db.query.examQuestions.findMany({
      where: (q, { eq }) => eq(q.sessionId, session.id),
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
        { ...stats, percentage: stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0 },
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
      announced:      true,
      sessionId:      session.id,
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
    console.error("[/api/portal]", err);
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to fetch result." }, { status: 500 });
  }
}
