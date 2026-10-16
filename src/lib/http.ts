import "server-only";
import { NextResponse } from "next/server";
import { GROUP, MESSAGES } from "./constants";
import { OrderError } from "./orders";
import type { ApiError } from "./types";

export const json = <T>(data: T, status = 200) =>
  NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });

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
