import "server-only";
import { NextResponse } from "next/server";
import { GROUP, MESSAGES } from "./constants";
import { OrderError } from "./orders";
import type { ApiError } from "./types";

export const json = <T>(data: T, status = 200) =>
  NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });

/** Response the CDN may cache for a few seconds (same for every visitor, nothing private). */
export const publicJson = <T>(data: T, sMaxAge: number, swr: number) => {
  const value = `public, max-age=0, s-maxage=${sMaxAge}, stale-while-revalidate=${swr}`;
  return NextResponse.json(data, {
    headers: { "Cache-Control": value, "CDN-Cache-Control": value, "Netlify-CDN-Cache-Control": value },
  });
};

export const fail = (error: string, status = 400) => json<ApiError>({ error }, status);

export function handleError(err: unknown) {
  if (err instanceof OrderError) return fail(err.message, err.status);
  console.error(err);
  return fail(MESSAGES.sendFail, 500);
}

export function callerFrom(req: Request): { memberId: string; hostToken: string } {
  return {
    memberId: (req.headers.get(GROUP.memberHeader) || "").slice(0, GROUP.memberIdMaxLength),
    hostToken: req.headers.get(GROUP.hostHeader) || "",
  };
}
