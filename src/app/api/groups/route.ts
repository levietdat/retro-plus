import { createGroup } from "@/lib/groups";
import { handleError, json } from "@/lib/http";
import type { CreateGroupInput } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    return json(await createGroup((await req.json()) as CreateGroupInput), 201);
  } catch (err) {
    return handleError(err);
  }
}
