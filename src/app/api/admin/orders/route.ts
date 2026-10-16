import { MESSAGES } from "@/lib/constants";
import { isAdminRequest } from "@/lib/auth";
import { dayKey } from "@/lib/format";
import { getOrdersForDay } from "@/lib/orders";
import { fail, handleError, json } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!isAdminRequest()) return fail(MESSAGES.unauthorized, 401);
  try {
    const day = new URL(req.url).searchParams.get("day");
    const target = day && /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : dayKey();
    return json({ day: target, orders: await getOrdersForDay(target) });
  } catch (err) {
    return handleError(err);
  }
}
