import { MESSAGES, ORDER_KEY_PARAM } from "@/lib/constants";
import { getPublicOrder } from "@/lib/orders";
import { fail, handleError, json } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: { code: string } }) {
  try {
    const key = new URL(req.url).searchParams.get(ORDER_KEY_PARAM) || "";
    const order = await getPublicOrder(decodeURIComponent(params.code), key);
    return order ? json(order) : fail(MESSAGES.orderNotFound, 404);
  } catch (err) {
    return handleError(err);
  }
}
