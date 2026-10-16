import { ADMIN_COOKIE, MESSAGES } from "@/lib/constants";
import { checkPassword, createSessionValue, isAdminConfigured } from "@/lib/auth";
import { fail, json } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!isAdminConfigured()) return fail(MESSAGES.adminNotConfigured, 500);
  const { password } = (await req.json().catch(() => ({}))) as { password?: string };
  if (!password || !checkPassword(password)) {
    await new Promise((r) => setTimeout(r, 600)); // slow down guessing
    return fail(MESSAGES.wrongPassword, 401);
  }
  const { value, maxAge } = createSessionValue();
  const res = json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, value, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge });
  return res;
}
