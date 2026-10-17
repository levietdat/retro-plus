import { addGroupItem } from "@/lib/groups";
import { callerFrom, handleError, json } from "@/lib/http";
import { assertRate, RateBucket } from "@/lib/rate-limit";
import type { AddGroupItemInput } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: { code: string } }) {
  try {
    assertRate(req, RateBucket.GroupWrites);
    return json(await addGroupItem(params.code, (await req.json()) as AddGroupItemInput, callerFrom(req)), 201);
  } catch (err) {
    return handleError(err);
  }
}
