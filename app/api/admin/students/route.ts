import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { validateAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { students } from "@/drizzle/schema";

export async function GET(req: NextRequest) {
  const auth = await validateAdmin(req);
  if (!auth.valid || !auth.isSuperAdmin)
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const rows = await db.select().from(students).orderBy(students.studentId);
  return NextResponse.json({ students: rows });
}

const AddSchema = z.object({
  studentId: z.string().min(3).max(50).trim().toUpperCase(),
});

const BulkSchema = z.object({
  studentIds: z.array(z.string().min(3).max(50).trim().toUpperCase()).min(1).max(500),
});

export async function POST(req: NextRequest) {
  const auth = await validateAdmin(req);
  if (!auth.valid || !auth.isSuperAdmin)
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  try {
    const body = await req.json();

    // Bulk upload
    if (Array.isArray(body.studentIds)) {
      const { studentIds } = BulkSchema.parse(body);
      const unique = [...new Set(studentIds)];
      const values = unique.map((id) => ({ studentId: id }));
      // onConflictDoNothing skips duplicates
      await db.insert(students).values(values).onConflictDoNothing();
      return NextResponse.json({ success: true, added: unique.length });
    }

    // Single add
    const { studentId } = AddSchema.parse(body);
    await db.insert(students).values({ studentId });
    return NextResponse.json({ success: true, studentId });
  } catch (err) {
    if (err instanceof z.ZodError)
      return NextResponse.json({ error: err.issues[0].message }, { status: 400 });
    const e = err as { code?: string };
    if (e.code === "23505")
      return NextResponse.json({ error: "Student ID already exists." }, { status: 409 });
    return NextResponse.json({ error: "Failed to add student." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await validateAdmin(req);
  if (!auth.valid || !auth.isSuperAdmin)
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { studentId } = await req.json();
  await db.delete(students).where(eq(students.studentId, studentId));
  return NextResponse.json({ success: true });
}
