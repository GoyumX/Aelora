import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import { supportTicketCreateSchema } from "@/lib/support/support";
import { createSupportTicket, SupportDomainError } from "@/lib/support/support-service";

const noStoreHeaders = { "Cache-Control": "private, no-store" };
function errorResponse(code: string, message: string, status: number) { return NextResponse.json({ error: { code, message } }, { status, headers: noStoreHeaders }); }

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return errorResponse("unauthorized", "Authentication is required.", 401);
  let body: unknown;
  try { body = await request.json(); } catch { return errorResponse("invalid_json", "A valid JSON body is required.", 400); }
  const parsed = supportTicketCreateSchema.safeParse(body);
  if (!parsed.success) return errorResponse("invalid_ticket", parsed.error.issues[0]?.message ?? "Review the ticket details.", 422);
  try {
    const ticket = await createSupportTicket(user.id, parsed.data);
    return NextResponse.json({ data: ticket }, { status: 201, headers: noStoreHeaders });
  } catch (error) {
    if (error instanceof SupportDomainError && error.code === "SITE_NOT_FOUND") return errorResponse("site_not_found", "The selected site is not available to this account.", 422);
    console.error("Unexpected support ticket failure", error);
    return errorResponse("internal_error", "The support ticket could not be created.", 500);
  }
}
