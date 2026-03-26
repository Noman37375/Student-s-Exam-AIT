import { db } from "@/lib/db";

export async function getActiveConfigPrompt(): Promise<string | null> {
  const config = await db.query.examConfigs.findFirst({
    where: (c, { eq }) => eq(c.isActive, true),
  });
  return config?.generatedPrompt ?? null;
}
