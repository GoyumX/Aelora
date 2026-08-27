import { NextResponse } from "next/server";

import { AlertDomainError, getSiteAlertsView, refreshSiteAlerts } from "@/lib/alerts/alert-service";
import { getCurrentUser } from "@/lib/auth/session";

const noStoreHeaders = { "Cache-Control": "private, no-store" };

function errorResponse(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status, headers: noStoreHeaders });
}

function alertError(error: unknown) {
  if (error instanceof AlertDomainError && error.code === "SITE_NOT_FOUND") {
    return errorResponse("site_not_found", "Solar site was not found.", 404);
  }
  console.error("Unexpected alerts failure", error);
  return errorResponse("internal_error", "Alerts could not be loaded.", 500);
}

export async function GET(_request: Request, { params }: { params: Promise<{ siteId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return errorResponse("unauthorized", "Authentication is required.", 401);
  const { siteId } = await params;
  try {
    return NextResponse.json({ data: await getSiteAlertsView(user, siteId) }, { headers: noStoreHeaders });
  } catch (error) {
    return alertError(error);
  }
}

export async function POST(_request: Request, { params }: { params: Promise<{ siteId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return errorResponse("unauthorized", "Authentication is required.", 401);
  const { siteId } = await params;
  try {
    const refresh = await refreshSiteAlerts(user, siteId);
    const view = await getSiteAlertsView(user, siteId);
    return NextResponse.json({ data: { refresh, view } }, { headers: noStoreHeaders });
  } catch (error) {
    return alertError(error);
  }
}
