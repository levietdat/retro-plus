import { submitGroup } from "@/lib/groups";
import { callerFrom, handleError, json } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: { code: string } }) {
  try {
    return json(await submitGroup(params.code, callerFrom(req)), 201);
  } catch (err) {
    return handleError(err);
  }
}
