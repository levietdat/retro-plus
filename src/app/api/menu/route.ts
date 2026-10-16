import { getMenu } from "@/lib/menu";
import { handleError, json } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return json(await getMenu());
  } catch (err) {
    return handleError(err);
  }
}
