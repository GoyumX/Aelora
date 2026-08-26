import { NextResponse } from "next/server";
import { adminTicketUpdateSchema } from "@/lib/admin/admin";
import { AdminDomainError, updateAdminSupportTicket } from "@/lib/admin/admin-service";
import { isAdmin } from "@/lib/auth/authorization";
import { getCurrentUser } from "@/lib/auth/session";
const headers = { "Cache-Control": "private, no-store" };
function error(code: string, message: string, status: number) { return NextResponse.json({ error: { code, message } }, { status, headers }); }
export async function PATCH(request: Request, { params }: { params: Promise<{ ticketId: string }> }) {
  const actor = await getCurrentUser(); if (!actor) return error("unauthorized", "Authentication is required.", 401); if (!isAdmin(actor)) return error("forbidden", "Administrator access is required.", 403);
  let body: unknown; try { body = await request.json(); } catch { return error("invalid_json", "A valid JSON body is required.", 400); }
  const parsed = adminTicketUpdateSchema.safeParse(body); if (!parsed.success) return error("invalid_ticket_update", parsed.error.issues[0]?.message ?? "Review the response and status.", 422);
  try { const { ticketId } = await params; return NextResponse.json({ data: await updateAdminSupportTicket({ id: actor.id, role: "ADMIN" }, ticketId, parsed.data) }, { headers }); }
  catch (cause) { if (cause instanceof AdminDomainError && cause.code === "TICKET_NOT_FOUND") return error("ticket_not_found", "Support ticket was not found.", 404); console.error("Unexpected admin ticket update failure", cause); return error("internal_error", "Support ticket could not be updated.", 500); }
}
