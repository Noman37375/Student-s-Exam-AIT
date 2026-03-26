import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { validateAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { examSessions, examConfigs } from "@/drizzle/schema";
import type { InferSelectModel } from "drizzle-orm";

type SessionRow = InferSelectModel<typeof examSessions>;

export async function GET(req: NextRequest) {
  const auth = await validateAdmin(req);
  if (!auth.valid) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  let sessions: SessionRow[];

  if (auth.isSuperAdmin) {
    // Super admin sees all submissions
    sessions = await db.query.examSessions.findMany({
      where: (s, { eq }) => eq(s.status, "submitted"),
      orderBy: (s, { desc }) => [desc(s.submittedAt)],
    });
  } else {
    // Teacher sees only submissions for their own configs
    const myConfigs = await db
      .select({ id: examConfigs.id })
      .from(examConfigs)
      .where(eq(examConfigs.createdBy, auth.username));

    const myConfigIds = myConfigs.map((c) => c.id);

    if (myConfigIds.length === 0) {
      sessions = [];
    } else {
      sessions = await db.query.examSessions.findMany({
        where: (s, { eq, and, inArray }) =>
          and(eq(s.status, "submitted"), inArray(s.configId, myConfigIds)),
        orderBy: (s, { desc }) => [desc(s.submittedAt)],
      });
    }
  }

  return NextResponse.json({ sessions, isSuperAdmin: auth.isSuperAdmin });
}

export async function DELETE(req: NextRequest) {
  const auth = await validateAdmin(req);
  if (!auth.valid || !auth.isSuperAdmin)
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { id } = await req.json();
  await db.delete(examSessions).where(eq(examSessions.id, id));
  return NextResponse.json({ success: true });
}
