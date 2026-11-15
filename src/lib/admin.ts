import "server-only";
import { createHash } from "node:crypto";
import { cookies } from "next/headers";

export const ADMIN_COOKIE = "sanity_admin";

/** The cookie holds a hash of the password, never the password itself. */
export function hashPassword(password: string): string {
  return createHash("sha256").update(`${password}|sanity-admin`).digest("hex");
}

export function adminToken(): string | null {
  const password = process.env.ADMIN_PASSWORD;
  return password ? hashPassword(password) : null;
}

export function adminEnabled(): boolean {
  return Boolean(process.env.ADMIN_PASSWORD);
}

export async function isAdmin(): Promise<boolean> {
  const token = adminToken();
  if (!token) return false;
  return (await cookies()).get(ADMIN_COOKIE)?.value === token;
}
