import { MESSAGES } from "@/lib/constants";
import { isAdminRequest } from "@/lib/auth";
import { isOrderStatus, patchOrder } from "@/lib/orders";
import { fail, handleError, json } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  if (!isAdminRequest()) return fail(MESSAGES.unauthorized, 401);
  try {
    const { status } = (await req.json()) as { status?: unknown };
    if (!isOrderStatus(status)) return fail(MESSAGES.invalidStatus);
    return json(await patchOrder(decodeURIComponent(params.id), { status }));
  } catch (err) {
    return handleError(err);
  }
}
