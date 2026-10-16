import { MESSAGES } from "@/lib/constants";
import { isAdminRequest } from "@/lib/auth";
import { isOrderStatus, patchOrder } from "@/lib/orders";
import { fail, handleError, json } from "@/lib/http";
import type { AdminOrderPatch } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  if (!isAdminRequest()) return fail(MESSAGES.unauthorized, 401);
  try {
    const body = (await req.json()) as { status?: unknown; paid?: unknown };
    const patch: AdminOrderPatch = {};
    if (body.status !== undefined) {
      if (!isOrderStatus(body.status)) return fail(MESSAGES.invalidStatus);
      patch.status = body.status;
    }
    if (typeof body.paid === "boolean") patch.paid = body.paid;
    if (patch.status === undefined && patch.paid === undefined) return fail(MESSAGES.invalidStatus);
    return json(await patchOrder(decodeURIComponent(params.id), patch));
  } catch (err) {
    return handleError(err);
  }
}
