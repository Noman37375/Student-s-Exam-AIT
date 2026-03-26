import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60; // Vercel Pro: allow up to 60s for LLM generation
import { z } from "zod";
import { db } from "@/lib/db";
import { examSessions, examQuestions } from "@/drizzle/schema";
import { generateAllQuestions } from "@/lib/llm";

const StartSchema = z.object({
  studentName: z.string().min(2).max(100).trim(),
  studentId:   z.string().min(1).max(50).trim().toUpperCase(),
  configId:    z.string().uuid().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { studentName, studentId, configId } = StartSchema.parse(body);

    // Step 1: Validate student ID exists in students table
    const student = await db.query.students.findFirst({
      where: (s, { eq }) => eq(s.studentId, studentId),
    });

    if (!student) {
      return NextResponse.json(
        { error: "Student ID not found. Please check your ID and try again." },
        { status: 403 }
      );
    }

    // Step 2: Check if this student already submitted
    const existing = await db.query.examSessions.findFirst({
      where: (s, { eq, and }) =>
        and(eq(s.studentId, studentId), eq(s.status, "submitted")),
    });

    if (existing) {
      return NextResponse.json(
        { error: "You have already submitted an exam.", alreadySubmitted: true, sessionId: existing.id },
        { status: 409 }
      );
    }

    // Step 3: Resolve config prompt
    let configPrompt: string | null = null;
    if (configId) {
      const config = await db.query.examConfigs.findFirst({
        where: (c, { eq }) => eq(c.id, configId),
      });
      configPrompt = config?.generatedPrompt ?? null;
    }

    // Step 4: Create exam session (store configId to track which teacher's exam)
    const [session] = await db
      .insert(examSessions)
      .values({ studentName, studentId, configId: configId ?? null })
      .returning({ id: examSessions.id });

    const sessionId = session.id;

    // Generate 40 questions via Groq API (3 parallel calls per topic)
    const questions = await generateAllQuestions(configPrompt);

    // Insert all questions into DB
    await db.insert(examQuestions).values(
      questions.map((q, index) => ({
        sessionId,
        topic:         q.topic,
        question:      q.question,
        optionA:       q.option_a,
        optionB:       q.option_b,
        optionC:       q.option_c,
        optionD:       q.option_d,
        correctAnswer: q.correct_answer,
        orderIndex:    index,
      }))
    );

    // Fetch inserted questions, strip correct answers
    const stored = await db.query.examQuestions.findMany({
      where: (q, { eq }) => eq(q.sessionId, sessionId),
      orderBy: (q, { asc }) => [asc(q.orderIndex)],
    });

    const safeQuestions = stored.map(
      ({ correctAnswer: _c, studentAnswer: _s, sessionId: _sid, ...rest }) => rest
    );

    return NextResponse.json({
      sessionId,
      studentName,
      studentId,
      questions: safeQuestions,
      durationMinutes: Number(process.env.EXAM_DURATION_MINUTES ?? 60),
    });
  } catch (err) {
    console.error("[/api/exam/start]", err);
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0].message }, { status: 400 });
    }
    // DB foreign key / constraint violation
    const dbErr = err as { code?: string };
    if (dbErr?.code === "23503") {
      return NextResponse.json({ error: "Student ID not found. Please check your ID and try again." }, { status: 403 });
    }
    return NextResponse.json({ error: "Failed to generate exam. Please try again." }, { status: 500 });
  }
}
