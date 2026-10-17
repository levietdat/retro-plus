import { STOREFRONT_CACHE } from "@/lib/constants";
import { getStorefront } from "@/lib/orders";
import { handleError, publicJson } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return publicJson(await getStorefront(), STOREFRONT_CACHE.sMaxAge, STOREFRONT_CACHE.staleWhileRevalidate);
  } catch (err) {
    return handleError(err);
  }
}
