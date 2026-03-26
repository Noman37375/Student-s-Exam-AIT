import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { validateAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { questionBank, examConfigs } from "@/drizzle/schema";
import { generateBankQuestions } from "@/lib/llm";
import type { QuestionTypeKey } from "@/lib/prompts";

export const maxDuration = 300;

const DEFAULT_BANK_COUNTS: Record<string, number> = {
  mcq:        200,
  true_false: 200,
  fill_blank: 100,
  code:       100,
};

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ configId: string }> }
) {
  const { configId } = await params;
  const auth = await validateAdmin(req);
  if (!auth.valid) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const config = await db.query.examConfigs.findFirst({
    where: (c, { eq }) => eq(c.id, configId),
  });
  if (!config) return NextResponse.json({ error: "Config not found." }, { status: 404 });
  if (!auth.isSuperAdmin && config.createdBy !== auth.username)
    return NextResponse.json({ error: "Unauthorized." }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const customCounts: Record<string, number> = body.counts ?? {};

  // Determine which types to generate (from config's questionConfig)
  const qConfig = (config.questionConfig as Record<string, { count: number; marksEach: number }> | null) ?? {};
  const VALID_TYPES = new Set(["mcq", "true_false", "fill_blank", "code"]);
  const typesToGenerate = Object.keys(qConfig).filter((t) => VALID_TYPES.has(t));

  if (typesToGenerate.length === 0) {
    return NextResponse.json({ error: "No valid question types in this config." }, { status: 400 });
  }

  const added: Record<string, number> = {};

  for (const typeKey of typesToGenerate) {
    const targetCount = customCounts[typeKey] ?? DEFAULT_BANK_COUNTS[typeKey] ?? 100;
    const marksEach = qConfig[typeKey]?.marksEach ?? 2;

    // Fetch existing questions to avoid duplication
    const existing = await db.select({ question: questionBank.question })
      .from(questionBank)
      .where(and(eq(questionBank.configId, configId), eq(questionBank.type, typeKey)));
    const existingTexts = existing.map((r) => r.question.slice(0, 80));

    try {
      const generated = await generateBankQuestions(
        typeKey as QuestionTypeKey,
        targetCount,
        config.generatedPrompt,
        existingTexts,
        marksEach,
      );

      if (generated.length === 0) continue;

      await db.insert(questionBank).values(
        generated.map((q) => ({
          configId,
          type:          typeKey,
          topic:         q.topic,
          question:      q.question,
          optionA:       q.option_a  ?? null,
          optionB:       q.option_b  ?? null,
          optionC:       q.option_c  ?? null,
          optionD:       q.option_d  ?? null,
          correctAnswer: q.correct_answer ?? "",
          modelAnswer:   q.model_answer   ?? null,
        }))
      );

      added[typeKey] = generated.length;
    } catch (err) {
      console.error(`[question-bank/generate] Failed for type ${typeKey}:`, err);
      added[typeKey] = 0;
    }
  }

  return NextResponse.json({ success: true, added });
}
