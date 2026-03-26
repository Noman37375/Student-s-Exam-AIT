import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;

import { z } from "zod";
import { eq, and, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { examSessions, examQuestions, questionBank } from "@/drizzle/schema";
import { generateAllQuestions, type GeneratedQuestion } from "@/lib/llm";
import type { QuestionConfig, QuestionTypeKey } from "@/lib/prompts";

// ─── Bank helpers ────────────────────────────────────────────────────────────

type QConfigMap = Record<string, { count: number; marksEach: number }>;

async function checkBankSufficiency(configId: string, questionConfig: QConfigMap): Promise<boolean> {
  const VALID = new Set(["mcq", "true_false", "fill_blank", "code"]);
  const types = Object.keys(questionConfig).filter((t) => VALID.has(t));
  for (const typeKey of types) {
    const needed = questionConfig[typeKey]?.count ?? 0;
    const [{ cnt }] = await db
      .select({ cnt: sql<number>`cast(count(*) as int)` })
      .from(questionBank)
      .where(and(eq(questionBank.configId, configId), eq(questionBank.type, typeKey)));
    if ((cnt ?? 0) < needed) return false;
  }
  return true;
}

function shuffleArr<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

async function pickFromBank(configId: string, questionConfig: QConfigMap): Promise<GeneratedQuestion[]> {
  const VALID = new Set(["mcq", "true_false", "fill_blank", "code"]);
  const types = Object.keys(questionConfig).filter((t) => VALID.has(t));
  const picked: GeneratedQuestion[] = [];

  for (const typeKey of types) {
    const cfg = questionConfig[typeKey];
    const allRows = await db.select().from(questionBank)
      .where(and(eq(questionBank.configId, configId), eq(questionBank.type, typeKey)));
    const selected = shuffleArr(allRows).slice(0, cfg.count);
    for (const row of selected) {
      picked.push({
        type:           typeKey as QuestionTypeKey,
        topic:          row.topic,
        question:       row.question,
        marks:          cfg.marksEach,
        option_a:       row.optionA   ?? undefined,
        option_b:       row.optionB   ?? undefined,
        option_c:       row.optionC   ?? undefined,
        option_d:       row.optionD   ?? undefined,
        correct_answer: row.correctAnswer || undefined,
        model_answer:   row.modelAnswer  ?? undefined,
      });
    }
  }
  return shuffleArr(picked);
}

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

    // Use question bank if available and sufficient, otherwise fall back to LLM
    let questions: GeneratedQuestion[];

    const bankAvailable = configId && questionConfig
      ? await checkBankSufficiency(configId, questionConfig as QConfigMap)
      : false;

    if (bankAvailable) {
      questions = await pickFromBank(configId!, questionConfig as QConfigMap);
    } else {
      const recentRows = await db.query.examQuestions.findMany({
        columns: { question: true },
        orderBy: (q, { desc }) => [desc(q.id)],
        limit: 60,
      });
      questions = await generateAllQuestions(
        teacherPrompt,
        questionConfig,
        recentRows.map((r) => r.question.slice(0, 80)),
      );
    }

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
