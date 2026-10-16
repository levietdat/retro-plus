import { getStats } from "@/lib/orders";
import { handleError, json } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return json(await getStats());
  } catch (err) {
    return handleError(err);
  }
}
