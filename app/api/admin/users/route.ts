import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { validateAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { adminUsers } from "@/drizzle/schema";

export async function GET(req: NextRequest) {
  const auth = await validateAdmin(req);
  if (!auth.valid || !auth.isSuperAdmin) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const users = await db.select({ id: adminUsers.id, username: adminUsers.username, createdAt: adminUsers.createdAt })
    .from(adminUsers).orderBy(adminUsers.createdAt);
  return NextResponse.json({ users });
}

const CreateSchema = z.object({
  username: z.string().min(3).max(30).trim(),
  password: z.string().min(4).max(100),
});

export async function POST(req: NextRequest) {
  const auth = await validateAdmin(req);
  if (!auth.valid || !auth.isSuperAdmin) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  try {
    const { username, password } = CreateSchema.parse(await req.json());
    const [user] = await db.insert(adminUsers).values({ username, password }).returning({
      id: adminUsers.id, username: adminUsers.username, createdAt: adminUsers.createdAt,
    });
    return NextResponse.json({ user });
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: err.issues[0].message }, { status: 400 });
    const e = err as { code?: string };
    if (e.code === "23505") return NextResponse.json({ error: "Username already exists." }, { status: 409 });
    return NextResponse.json({ error: "Failed to create user." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await validateAdmin(req);
  if (!auth.valid || !auth.isSuperAdmin) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { id } = await req.json();
  await db.delete(adminUsers).where(eq(adminUsers.id, id));
  return NextResponse.json({ success: true });
}
