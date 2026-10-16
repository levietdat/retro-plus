import { MESSAGES } from "@/lib/constants";
import { getGroup, updateGroup } from "@/lib/groups";
import { callerFrom, fail, handleError, json } from "@/lib/http";
import type { UpdateGroupInput } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: { code: string } }) {
  try {
    const group = await getGroup(params.code, callerFrom(req));
    return group ? json(group) : fail(MESSAGES.groupNotFound, 404);
  } catch (err) {
    return handleError(err);
  }
}

export async function PATCH(req: Request, { params }: { params: { code: string } }) {
  try {
    return json(await updateGroup(params.code, (await req.json()) as UpdateGroupInput, callerFrom(req)));
  } catch (err) {
    return handleError(err);
  }
}
