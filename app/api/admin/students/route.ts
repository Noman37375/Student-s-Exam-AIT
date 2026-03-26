import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { validateAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { students } from "@/drizzle/schema";

export async function GET(req: NextRequest) {
  const auth = await validateAdmin(req);
  if (!auth.valid) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const rows = auth.isSuperAdmin
    ? await db.select().from(students).orderBy(students.studentId)
    : await db.select().from(students)
        .where(eq(students.teacher, auth.username))
        .orderBy(students.studentId);

  return NextResponse.json({ students: rows });
}

const AddSchema = z.object({
  studentId: z.string().min(3).max(50).trim().toUpperCase(),
  teacher:   z.string().optional(),
});

const BulkSchema = z.object({
  studentIds: z.array(z.string().min(3).max(50).trim().toUpperCase()).min(1).max(500),
  teacher:    z.string().optional(),
});

export async function POST(req: NextRequest) {
  const auth = await validateAdmin(req);
  if (!auth.valid) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  try {
    const body = await req.json();
    // Teacher is always themselves for non-super-admins
    const assignedTeacher = auth.isSuperAdmin ? (body.teacher ?? null) : auth.username;

    if (Array.isArray(body.studentIds)) {
      const { studentIds } = BulkSchema.parse(body);
      const unique = [...new Set(studentIds)];
      const values = unique.map((id) => ({ studentId: id, teacher: assignedTeacher }));
      await db.insert(students).values(values).onConflictDoNothing();
      return NextResponse.json({ success: true, added: unique.length });
    }

    const { studentId } = AddSchema.parse(body);
    await db.insert(students).values({ studentId, teacher: assignedTeacher });
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

// PATCH — reassign a student's teacher (super admin only)
export async function PATCH(req: NextRequest) {
  const auth = await validateAdmin(req);
  if (!auth.valid || !auth.isSuperAdmin)
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { studentId, teacher } = await req.json();
  if (!studentId) return NextResponse.json({ error: "studentId required." }, { status: 400 });

  await db.update(students)
    .set({ teacher: teacher ?? null })
    .where(eq(students.studentId, studentId));

  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const auth = await validateAdmin(req);
  if (!auth.valid) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { studentId } = await req.json();

  if (!auth.isSuperAdmin) {
    // Teacher can only delete their own students
    const student = await db.query.students.findFirst({
      where: (s, { eq }) => eq(s.studentId, studentId),
    });
    if (student?.teacher !== auth.username)
      return NextResponse.json({ error: "Unauthorized." }, { status: 403 });
  }

  await db.delete(students).where(eq(students.studentId, studentId));
  return NextResponse.json({ success: true });
}
