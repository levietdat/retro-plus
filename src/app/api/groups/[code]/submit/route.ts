import { submitGroup } from "@/lib/groups";
import { callerFrom, handleError, json } from "@/lib/http";
import { assertRate, RateBucket } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: { code: string } }) {
  try {
    assertRate(req, RateBucket.Orders);
    return json(await submitGroup(params.code, callerFrom(req)), 201);
  } catch (err) {
    return handleError(err);
  }
}
