import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { examSessions, examQuestions } from "@/drizzle/schema";
import { gradeExam } from "@/lib/grader";

const SubmitSchema = z.object({
  sessionId: z.string().uuid(),
  answers: z.record(z.string().uuid(), z.enum(["A", "B", "C", "D"])),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { sessionId, answers } = SubmitSchema.parse(body);

    // Validate session exists and is in progress
    const session = await db.query.examSessions.findFirst({
      where: (s, { eq }) => eq(s.id, sessionId),
    });

    if (!session) {
      return NextResponse.json({ error: "Session not found." }, { status: 404 });
    }
    if (session.status !== "in_progress") {
      return NextResponse.json({ error: "Exam already submitted." }, { status: 409 });
    }

    // Fetch all questions for this session
    const questions = await db.query.examQuestions.findMany({
      where: (q, { eq }) => eq(q.sessionId, sessionId),
    });

    // Attach student answers and grade
    const gradingInput = questions.map((q) => ({
      id:            q.id,
      topic:         q.topic,
      correctAnswer: q.correctAnswer!,
      studentAnswer: answers[q.id] ?? null,
    }));

    const result = gradeExam(gradingInput);

    // Update each question with student answer
    await Promise.all(
      Object.entries(answers).map(([questionId, answer]) =>
        db
          .update(examQuestions)
          .set({ studentAnswer: answer })
          .where(eq(examQuestions.id, questionId))
      )
    );

    // Update session with score and status
    const now = new Date();
    await db
      .update(examSessions)
      .set({ score: result.score, status: "submitted", submittedAt: now })
      .where(eq(examSessions.id, sessionId));

    return NextResponse.json({ score: result.score, totalMarks: result.totalMarks });
  } catch (err) {
    console.error("[/api/exam/submit]", err);
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to submit exam." }, { status: 500 });
  }
}
