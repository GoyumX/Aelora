import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { getLatestTelemetrySnapshot } from "@/lib/telemetry/latest-service";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ siteId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: { code: "unauthorized", message: "Authentication is required." } },
      { status: 401 },
    );
  }

  const { siteId } = await params;
  const site = await db.solarSite.findFirst({
    where: {
      id: siteId,
      deletedAt: null,
      ...(user.role === "ADMIN" ? {} : { ownerId: user.id }),
    },
    select: { id: true, name: true },
  });

  if (!site) {
    return NextResponse.json(
      { error: { code: "not_found", message: "Solar site was not found." } },
      { status: 404 },
    );
  }

  const telemetry = await getLatestTelemetrySnapshot(site);
  if (!telemetry) {
    return NextResponse.json(
      { error: { code: "no_telemetry", message: "No telemetry has been received for this site yet." } },
      { status: 404, headers: { "Cache-Control": "private, no-store" } },
    );
  }

  return NextResponse.json(
    { data: telemetry, meta: { refreshAfterSeconds: telemetry.connectivity.gateway.expectedIntervalSec } },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
