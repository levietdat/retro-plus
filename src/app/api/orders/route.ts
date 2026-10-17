import { createOrder } from "@/lib/orders";
import { handleError, json } from "@/lib/http";
import { assertRate, RateBucket } from "@/lib/rate-limit";
import type { CreateOrderInput } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    assertRate(req, RateBucket.Orders);
    const body = (await req.json()) as CreateOrderInput;
    return json(await createOrder(body), 201);
  } catch (err) {
    return handleError(err);
  }
}
