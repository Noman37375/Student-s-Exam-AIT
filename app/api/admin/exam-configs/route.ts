import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { examConfigs } from "@/drizzle/schema";

export async function GET(req: NextRequest) {
  const auth = await validateAdmin(req);
  if (!auth.valid) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const configs = await db.query.examConfigs.findMany({
    where: auth.isSuperAdmin
      ? undefined
      : (c, { eq }) => eq(c.createdBy, auth.username),
    orderBy: (c, { desc }) => [desc(c.createdAt)],
  });
  return NextResponse.json({ configs });
}

const QTypeSchema = z.object({ count: z.number().int().min(1), marksEach: z.number().int().min(1) });

const CreateSchema = z.object({
  title:          z.string().min(2).max(100).trim(),
  prompt:         z.string().min(20).max(5000).trim(),
  totalMarks:     z.number().int().min(1),
  questionConfig: z.record(z.string(), QTypeSchema),
});

export async function POST(req: NextRequest) {
  const auth = await validateAdmin(req);
  if (!auth.valid) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  try {
    const { title, prompt, totalMarks, questionConfig } = CreateSchema.parse(await req.json());

    const [config] = await db.insert(examConfigs).values({
      title,
      description:     prompt,
      generatedPrompt: prompt,
      createdBy:       auth.username,
      isActive:        false,
      totalMarks,
      questionConfig,
    }).returning();

    return NextResponse.json({ config });
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: err.issues[0].message }, { status: 400 });
    return NextResponse.json({ error: "Failed to create exam config." }, { status: 500 });
  }
}
