import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;

import { z } from "zod";
import { db } from "@/lib/db";
import { examSessions, examQuestions } from "@/drizzle/schema";
import { generateAllQuestions } from "@/lib/llm";
import type { QuestionConfig } from "@/lib/prompts";

const StartSchema = z.object({
  studentName: z.string().min(2).max(100).trim(),
  studentId:   z.string().min(1).max(50).trim().toUpperCase(),
  configId:    z.string().uuid().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const { studentName, studentId, configId } = StartSchema.parse(await req.json());

    // Validate student ID
    const student = await db.query.students.findFirst({
      where: (s, { eq }) => eq(s.studentId, studentId),
    });
    if (!student) {
      return NextResponse.json({ error: "Student ID not found. Please check your ID and try again." }, { status: 403 });
    }

    // Validate teacher-student link
    if (configId && student.teacher) {
      const cfg = await db.query.examConfigs.findFirst({
        where: (c, { eq }) => eq(c.id, configId),
      });
      if (cfg && cfg.createdBy !== student.teacher) {
        return NextResponse.json({
          error: `You are registered under "${student.teacher}" and cannot take this teacher's exam.`,
        }, { status: 403 });
      }
    }

    // Check already submitted
    const existing = await db.query.examSessions.findFirst({
      where: (s, { eq, and }) => and(eq(s.studentId, studentId), eq(s.status, "submitted")),
    });
    if (existing) {
      return NextResponse.json(
        { error: "You have already submitted an exam.", alreadySubmitted: true, sessionId: existing.id },
        { status: 409 }
      );
    }

    // Resolve config
    let teacherPrompt:   string | null = null;
    let questionConfig:  QuestionConfig | null = null;
    let configTotalMarks: number | null = null;

    if (configId) {
      const config = await db.query.examConfigs.findFirst({
        where: (c, { eq }) => eq(c.id, configId),
      });
      teacherPrompt    = config?.generatedPrompt ?? null;
      questionConfig   = (config?.questionConfig as QuestionConfig) ?? null;
      configTotalMarks = config?.totalMarks ?? null;
    }

    // Create session — use config total marks if available
    const sessionTotalMarks = configTotalMarks ?? 80;
    const [session] = await db
      .insert(examSessions)
      .values({ studentName, studentId, configId: configId ?? null, totalMarks: sessionTotalMarks })
      .returning({ id: examSessions.id });

    const sessionId = session.id;

    // Fetch recently used questions to reduce repetition across sessions
    const recentRows = await db.query.examQuestions.findMany({
      columns: { question: true },
      orderBy: (q, { desc }) => [desc(q.id)],
      limit: 60,
    });
    // Trim to first 80 chars each so the prompt stays compact
    const recentQuestions = recentRows.map((r) => r.question.slice(0, 80));

    // Generate questions
    const questions = await generateAllQuestions(teacherPrompt, questionConfig, recentQuestions);

    // Insert questions with type + marks
    await db.insert(examQuestions).values(
      questions.map((q, index) => ({
        sessionId,
        topic:         q.topic,
        question:      q.question,
        optionA:       q.option_a      ?? "",
        optionB:       q.option_b      ?? "",
        optionC:       q.option_c      ?? "",
        optionD:       q.option_d      ?? "",
        correctAnswer: q.correct_answer ?? "-",
        orderIndex:    index,
        questionType:  q.type,
        marks:         q.marks,
        modelAnswer:   q.model_answer  ?? null,
      }))
    );

    // Fetch stored questions, strip sensitive fields
    const stored = await db.query.examQuestions.findMany({
      where: (q, { eq }) => eq(q.sessionId, sessionId),
      orderBy: (q, { asc }) => [asc(q.orderIndex)],
    });

    const safeQuestions = stored.map(
      ({ correctAnswer: _c, studentAnswer: _s, modelAnswer: _m, aiScore: _a, sessionId: _sid, ...rest }) => rest
    );

    return NextResponse.json({
      sessionId,
      studentName,
      studentId,
      questions:       safeQuestions,
      durationMinutes: Number(process.env.EXAM_DURATION_MINUTES ?? 60),
      totalMarks:      sessionTotalMarks,
    });
  } catch (err) {
    console.error("[/api/exam/start]", err);
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0].message }, { status: 400 });
    }
    const dbErr = err as { code?: string };
    if (dbErr?.code === "23503") {
      return NextResponse.json({ error: "Student ID not found. Please check your ID and try again." }, { status: 403 });
    }
    return NextResponse.json({ error: "Failed to generate exam. Please try again." }, { status: 500 });
  }
}
