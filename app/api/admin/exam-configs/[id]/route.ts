import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { validateAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { examConfigs } from "@/drizzle/schema";

// POST /api/admin/exam-configs/[id] — toggle active
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await validateAdmin(req);
  if (!auth.valid) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { id } = await params;
  const { activate } = await req.json();

  await db.update(examConfigs).set({ isActive: activate }).where(eq(examConfigs.id, id));

  return NextResponse.json({ success: true });
}

// PATCH /api/admin/exam-configs/[id] — edit title, prompt, questionConfig, totalMarks
const QTypeSchema = z.object({ count: z.number().int().min(1), marksEach: z.number().int().min(1) });

const EditSchema = z.object({
  title:          z.string().min(2).max(100).trim(),
  prompt:         z.string().min(20).max(5000).trim(),
  totalMarks:     z.number().int().min(1),
  questionConfig: z.record(z.string(), QTypeSchema),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await validateAdmin(req);
  if (!auth.valid) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { id } = await params;

  const config = await db.query.examConfigs.findFirst({ where: (c, { eq }) => eq(c.id, id) });
  if (!config) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (!auth.isSuperAdmin && config.createdBy !== auth.username)
    return NextResponse.json({ error: "Unauthorized." }, { status: 403 });

  try {
    const { title, prompt, totalMarks, questionConfig } = EditSchema.parse(await req.json());
    await db.update(examConfigs)
      .set({ title, description: prompt, generatedPrompt: prompt, totalMarks, questionConfig })
      .where(eq(examConfigs.id, id));
    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: err.issues[0].message }, { status: 400 });
    return NextResponse.json({ error: "Failed to update." }, { status: 500 });
  }
}

// DELETE /api/admin/exam-configs/[id]
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await validateAdmin(req);
  if (!auth.valid) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { id } = await params;
  const config = await db.query.examConfigs.findFirst({ where: (c, { eq }) => eq(c.id, id) });
  if (config?.isActive) return NextResponse.json({ error: "Deactivate config before deleting." }, { status: 400 });

  await db.delete(examConfigs).where(eq(examConfigs.id, id));
  return NextResponse.json({ success: true });
}
