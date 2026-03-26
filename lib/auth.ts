import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { adminUsers } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export type AdminAuthResult =
  | { valid: false }
  | { valid: true; isSuperAdmin: true;  username: "superadmin" }
  | { valid: true; isSuperAdmin: false; username: string };

export async function validateAdmin(req: NextRequest): Promise<AdminAuthResult> {
  const token = req.headers.get("x-admin-token") ?? "";
  if (!token) return { valid: false };

  // Super admin: bare env password (checked first)
  if (token === process.env.ADMIN_PASSWORD) {
    return { valid: true, isSuperAdmin: true, username: "superadmin" };
  }

  // Sub-admin: "username:password"
  const colonIdx = token.indexOf(":");
  if (colonIdx > 0) {
    const username = token.slice(0, colonIdx);
    const password = token.slice(colonIdx + 1);
    const [row] = await db.select().from(adminUsers).where(eq(adminUsers.username, username)).limit(1);
    if (row && row.password === password) {
      return { valid: true, isSuperAdmin: false, username };
    }
  }

  return { valid: false };
}
