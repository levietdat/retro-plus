import { MESSAGES } from "@/lib/constants";
import { getPublicOrder } from "@/lib/orders";
import { fail, handleError, json } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { code: string } }) {
  try {
    const order = await getPublicOrder(decodeURIComponent(params.code));
    return order ? json(order) : fail(MESSAGES.orderNotFound, 404);
  } catch (err) {
    return handleError(err);
  }
}
