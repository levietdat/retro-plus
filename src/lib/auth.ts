import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { ADMIN_COOKIE, ADMIN_SESSION_HOURS, ENV } from "./constants";

const secret = () => process.env[ENV.sessionSecret] || process.env[ENV.adminPassword] || "";

function sign(value: string): string {
  return createHmac("sha256", secret()).update(value).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

export function isAdminConfigured(): boolean {
  return Boolean(process.env[ENV.adminPassword]);
}

export function checkPassword(input: string): boolean {
  const expected = process.env[ENV.adminPassword];
  return Boolean(expected) && safeEqual(input, expected as string);
}

export function createSessionValue(): { value: string; maxAge: number } {
  const maxAge = ADMIN_SESSION_HOURS * 3600;
  const exp = String(Date.now() + maxAge * 1000);
  return { value: `${exp}.${sign(exp)}`, maxAge };
}

export function isAdminRequest(): boolean {
  if (!isAdminConfigured()) return false;
  const raw = cookies().get(ADMIN_COOKIE)?.value;
  if (!raw) return false;
  const [exp, sig] = raw.split(".");
  if (!exp || !sig || !safeEqual(sig, sign(exp))) return false;
  return Number(exp) > Date.now();
}
