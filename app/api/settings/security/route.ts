import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { getCurrentUser } from "@/lib/auth/session";
import { passwordChangeSchema } from "@/lib/settings/settings";

const noStoreHeaders = { "Cache-Control": "private, no-store" };
function errorResponse(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status, headers: noStoreHeaders });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return errorResponse("unauthorized", "Authentication is required.", 401);
  let body: unknown;
  try { body = await request.json(); } catch { return errorResponse("invalid_json", "A valid JSON body is required.", 400); }
  const parsed = passwordChangeSchema.safeParse(body);
  if (!parsed.success) return errorResponse("invalid_password", parsed.error.issues[0]?.message ?? "Review the password fields.", 422);
  try {
    await auth.api.changePassword({ headers: request.headers, body: { ...parsed.data, revokeOtherSessions: true } });
    return NextResponse.json({ data: { changed: true, otherSessionsRevoked: true } }, { headers: noStoreHeaders });
  } catch {
    return errorResponse("password_change_failed", "The current password is incorrect or the new password was rejected.", 400);
  }
}

export async function DELETE(request: Request) {
  const user = await getCurrentUser();
  if (!user) return errorResponse("unauthorized", "Authentication is required.", 401);
  try {
    await auth.api.revokeOtherSessions({ headers: request.headers });
    return NextResponse.json({ data: { otherSessionsRevoked: true } }, { headers: noStoreHeaders });
  } catch {
    return errorResponse("session_revoke_failed", "Other sessions could not be signed out.", 400);
  }
}
