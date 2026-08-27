import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import { settingsUpdateSchema } from "@/lib/settings/settings";
import { SettingsDomainError, updateUserSettings } from "@/lib/settings/settings-service";

const noStoreHeaders = { "Cache-Control": "private, no-store" };
function errorResponse(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status, headers: noStoreHeaders });
}

export async function PUT(request: Request) {
  const user = await getCurrentUser();
  if (!user) return errorResponse("unauthorized", "Authentication is required.", 401);
  let body: unknown;
  try { body = await request.json(); } catch { return errorResponse("invalid_json", "A valid JSON body is required.", 400); }
  const parsed = settingsUpdateSchema.safeParse(body);
  if (!parsed.success) return errorResponse("invalid_settings", parsed.error.issues[0]?.message ?? "Review your settings.", 422);
  try {
    const settings = await updateUserSettings(user.id, parsed.data);
    return NextResponse.json({ data: settings }, { headers: noStoreHeaders });
  } catch (error) {
    if (error instanceof SettingsDomainError && error.code === "DEFAULT_SITE_NOT_FOUND") return errorResponse("default_site_not_found", "The selected site is not available to this account.", 422);
    if (error instanceof SettingsDomainError && error.code === "USERNAME_TAKEN") return errorResponse("username_taken", "That username is already in use.", 409);
    console.error("Unexpected settings update failure", error);
    return errorResponse("internal_error", "Settings could not be saved.", 500);
  }
}
