import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import { findConfigurableSite } from "@/lib/configuration/site-access";
import { db } from "@/lib/db";
import { historyQuerySchema } from "@/lib/telemetry/history";
import { getHistoricalTelemetry } from "@/lib/telemetry/history-service";

export async function GET(request: Request, { params }: { params: Promise<{ siteId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: { code: "unauthorized", message: "Authentication is required." } }, { status: 401 });
  const { siteId } = await params;
  if (!await findConfigurableSite(user, siteId)) return NextResponse.json({ error: { code: "not_found", message: "Solar site was not found." } }, { status: 404 });
  const url = new URL(request.url);
  const parsed = historyQuerySchema.safeParse({ from: url.searchParams.get("from"), to: url.searchParams.get("to"), grain: url.searchParams.get("grain") ?? "day" });
  if (!parsed.success) return NextResponse.json({ error: { code: "validation_error", message: parsed.error.issues.map((issue) => issue.message).join("; ") } }, { status: 422 });
  const site = await db.solarSite.findUniqueOrThrow({ where: { id: siteId }, select: { id: true, name: true, timezone: true } });
  const data = await getHistoricalTelemetry(site, new Date(`${parsed.data.from}T00:00:00.000Z`), new Date(`${parsed.data.to}T00:00:00.000Z`), parsed.data.grain);
  return NextResponse.json({ data }, { headers: { "Cache-Control": "private, max-age=60" } });
}
