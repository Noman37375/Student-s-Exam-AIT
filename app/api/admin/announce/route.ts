import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { validateAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { examSessions } from "@/drizzle/schema";

const Schema = z.object({
  mode:      z.enum(["all", "single"]),
  sessionId: z.string().uuid().optional(),
  visible:   z.boolean(),
});

export async function POST(req: NextRequest) {
  const auth = await validateAdmin(req);
  if (!auth.valid) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  try {
    const { mode, sessionId, visible } = Schema.parse(await req.json());

    if (mode === "all") {
      await db.update(examSessions).set({ resultVisible: visible }).where(eq(examSessions.status, "submitted"));
      return NextResponse.json({ success: true, message: `All results ${visible ? "announced" : "hidden"}.` });
    }
    if (mode === "single" && sessionId) {
      await db.update(examSessions).set({ resultVisible: visible })
        .where(and(eq(examSessions.id, sessionId), eq(examSessions.status, "submitted")));
      return NextResponse.json({ success: true });
    }
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: err.issues[0].message }, { status: 400 });
    return NextResponse.json({ error: "Failed to update." }, { status: 500 });
  }
}
