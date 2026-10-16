import { MESSAGES } from "@/lib/constants";
import { isAdminRequest } from "@/lib/auth";
import { fail, handleError, json } from "@/lib/http";
import { getSettings, updateSettings, type SettingsPatch } from "@/lib/settings";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!isAdminRequest()) return fail(MESSAGES.unauthorized, 401);
  try {
    return json(await getSettings());
  } catch (err) {
    return handleError(err);
  }
}

export async function PATCH(req: Request) {
  if (!isAdminRequest()) return fail(MESSAGES.unauthorized, 401);
  try {
    return json(await updateSettings((await req.json()) as SettingsPatch));
  } catch (err) {
    return handleError(err);
  }
}
