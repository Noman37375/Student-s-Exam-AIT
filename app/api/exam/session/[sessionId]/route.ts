import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

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

    if (session.status !== "in_progress") {
      return NextResponse.json({ error: "Exam already submitted.", status: session.status }, { status: 409 });
    }

    const questions = await db.query.examQuestions.findMany({
      where: (q, { eq }) => eq(q.sessionId, sessionId),
      orderBy: (q, { asc }) => [asc(q.orderIndex)],
    });

    // Strip correct answers before sending to client
    const safeQuestions = questions.map(
      ({ correctAnswer: _c, studentAnswer: _s, sessionId: _sid, ...rest }) => rest
    );

    return NextResponse.json({
      sessionId,
      studentName:     session.studentName,
      studentId:       session.studentId,
      questions:       safeQuestions,
      durationMinutes: Number(process.env.EXAM_DURATION_MINUTES ?? 60),
    });
  } catch (err) {
    console.error("[/api/exam/session]", err);
    return NextResponse.json({ error: "Failed to load session." }, { status: 500 });
  }
}
