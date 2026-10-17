import "server-only";
import { MESSAGES, RATE_LIMIT } from "./constants";
import { OrderError } from "./orders";

/**
 * Best-effort spam guard: a sliding window per IP, kept in memory of one serverless
 * instance. It stops a script hammering the order form; it is not a security boundary.
 * For hard limits add a Netlify rate-limit rule (see README).
 */
const hits = new Map<string, number[]>();

export enum RateBucket {
  Orders = "orders",
  GroupWrites = "group",
}

const LIMIT: Record<RateBucket, number> = {
  [RateBucket.Orders]: RATE_LIMIT.orders,
  [RateBucket.GroupWrites]: RATE_LIMIT.groupWrites,
};

export function clientIp(req: Request): string {
  for (const h of RATE_LIMIT.ipHeaders) {
    const v = req.headers.get(h);
    if (v) return v.split(",")[0].trim();
  }
  return "unknown";
}

export function assertRate(req: Request, bucket: RateBucket): void {
  const now = Date.now();
  const key = `${bucket}:${clientIp(req)}`;
  const recent = (hits.get(key) ?? []).filter((t) => now - t < RATE_LIMIT.windowMs);
  if (recent.length >= LIMIT[bucket]) throw new OrderError(MESSAGES.tooMany, 429);
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) {
    // keep memory bounded on a long-lived instance
    for (const [k, v] of hits) if (!v.some((t) => now - t < RATE_LIMIT.windowMs)) hits.delete(k);
  }
}
