import { NextResponse } from "next/server";
import { adminUserStatusSchema } from "@/lib/admin/admin";
import { AdminDomainError, updateAdminUserStatus } from "@/lib/admin/admin-service";
import { isAdmin } from "@/lib/auth/authorization";
import { getCurrentUser } from "@/lib/auth/session";
const headers = { "Cache-Control": "private, no-store" };
function error(code: string, message: string, status: number) { return NextResponse.json({ error: { code, message } }, { status, headers }); }
export async function PATCH(request: Request, { params }: { params: Promise<{ userId: string }> }) {
  const actor = await getCurrentUser(); if (!actor) return error("unauthorized", "Authentication is required.", 401); if (!isAdmin(actor)) return error("forbidden", "Administrator access is required.", 403);
  let body: unknown; try { body = await request.json(); } catch { return error("invalid_json", "A valid JSON body is required.", 400); }
  const parsed = adminUserStatusSchema.safeParse(body); if (!parsed.success) return error("invalid_status", parsed.error.issues[0]?.message ?? "Choose a valid user status.", 422);
  try { const { userId } = await params; return NextResponse.json({ data: await updateAdminUserStatus({ id: actor.id, role: "ADMIN" }, userId, parsed.data) }, { headers }); }
  catch (cause) { if (cause instanceof AdminDomainError && cause.code === "SELF_DISABLE_FORBIDDEN") return error("self_disable_forbidden", "You cannot disable your current administrator account.", 409); if (cause instanceof AdminDomainError && cause.code === "TARGET_NOT_FOUND") return error("user_not_found", "User was not found.", 404); console.error("Unexpected admin user update failure", cause); return error("internal_error", "User access could not be updated.", 500); }
}
