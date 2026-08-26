import { NextResponse } from "next/server";
import { z } from "zod";

import { AlertDomainError, updateSiteAlert } from "@/lib/alerts/alert-service";
import { getCurrentUser } from "@/lib/auth/session";

const actionSchema = z.object({ action: z.enum(["ACKNOWLEDGE", "RESOLVE"]) });
const noStoreHeaders = { "Cache-Control": "private, no-store" };

function errorResponse(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status, headers: noStoreHeaders });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ siteId: string; alertId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return errorResponse("unauthorized", "Authentication is required.", 401);
  const parsed = actionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return errorResponse("validation_error", "Action must be ACKNOWLEDGE or RESOLVE.", 422);
  const { siteId, alertId } = await params;
  try {
    const incident = await updateSiteAlert(user, siteId, alertId, parsed.data.action);
    return NextResponse.json({ data: { incident } }, { headers: noStoreHeaders });
  } catch (error) {
    if (error instanceof AlertDomainError) {
      if (error.code === "ALREADY_RESOLVED") return errorResponse("already_resolved", "This incident is already resolved.", 409);
      return errorResponse("not_found", "Solar site or alert was not found.", 404);
    }
    console.error("Unexpected alert lifecycle failure", error);
    return errorResponse("internal_error", "The incident could not be updated.", 500);
  }
}
