import { removeGroupItem, updateGroupItem } from "@/lib/groups";
import { callerFrom, handleError, json } from "@/lib/http";
import type { UpdateGroupItemInput } from "@/lib/types";

export const dynamic = "force-dynamic";

type Ctx = { params: { code: string; itemId: string } };

export async function PATCH(req: Request, { params }: Ctx) {
  try {
    return json(await updateGroupItem(params.code, params.itemId, (await req.json()) as UpdateGroupItemInput, callerFrom(req)));
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(req: Request, { params }: Ctx) {
  try {
    return json(await removeGroupItem(params.code, params.itemId, callerFrom(req)));
  } catch (err) {
    return handleError(err);
  }
}
