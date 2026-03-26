import { NextRequest, NextResponse } from "next/server";
import { eq, and, sql } from "drizzle-orm";
import { validateAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { questionBank, examConfigs } from "@/drizzle/schema";

async function getConfigAndAuth(req: NextRequest, configId: string) {
  const auth = await validateAdmin(req);
  if (!auth.valid) return { error: "Unauthorized.", status: 401 };
  const config = await db.query.examConfigs.findFirst({
    where: (c, { eq }) => eq(c.id, configId),
  });
  if (!config) return { error: "Config not found.", status: 404 };
  if (!auth.isSuperAdmin && config.createdBy !== auth.username)
    return { error: "Unauthorized.", status: 403 };
  return { auth, config };
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ configId: string }> }
) {
  const { configId } = await params;
  const result = await getConfigAndAuth(req, configId);
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });

  const url = new URL(req.url);
  const type = url.searchParams.get("type");

  if (type) {
    const questions = await db.select().from(questionBank)
      .where(and(eq(questionBank.configId, configId), eq(questionBank.type, type)))
      .orderBy(questionBank.createdAt);
    return NextResponse.json({ questions });
  }

  // Return counts per type
  const rows = await db.select({
    type: questionBank.type,
    count: sql<number>`cast(count(*) as int)`,
  }).from(questionBank)
    .where(eq(questionBank.configId, configId))
    .groupBy(questionBank.type);

  const counts: Record<string, number> = {};
  let total = 0;
  for (const row of rows) {
    counts[row.type] = row.count;
    total += row.count;
  }
  return NextResponse.json({ counts, total });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ configId: string }> }
) {
  const { configId } = await params;
  const result = await getConfigAndAuth(req, configId);
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });

  const body = await req.json().catch(() => ({}));

  if (body.id) {
    await db.delete(questionBank)
      .where(and(eq(questionBank.id, body.id), eq(questionBank.configId, configId)));
    return NextResponse.json({ success: true });
  }

  // Delete all for this config
  await db.delete(questionBank).where(eq(questionBank.configId, configId));
  return NextResponse.json({ success: true });
}
