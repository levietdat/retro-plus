import { getMyOrders } from "@/lib/orders";
import { handleError, json } from "@/lib/http";
import type { MyOrderLookup } from "@/lib/types";

export const dynamic = "force-dynamic";

/** POST so the private keys stay out of URLs and logs. */
export async function POST(req: Request) {
  try {
    const { refs } = (await req.json()) as { refs?: MyOrderLookup[] };
    return json(await getMyOrders(Array.isArray(refs) ? refs : []));
  } catch (err) {
    return handleError(err);
  }
}
