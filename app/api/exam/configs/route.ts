import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// Public endpoint — students use this to pick a teacher's exam
export async function GET() {
  const configs = await db.query.examConfigs.findMany({
    where: (c, { eq }) => eq(c.isActive, true),
    orderBy: (c, { asc }) => [asc(c.createdAt)],
  });

  return NextResponse.json({
    configs: configs.map((c) => ({
      id:             c.id,
      title:          c.title,
      createdBy:      c.createdBy,
      questionConfig: c.questionConfig ?? null,
    })),
  });
}
