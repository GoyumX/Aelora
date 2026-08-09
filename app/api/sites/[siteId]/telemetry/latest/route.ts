import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { createTelemetrySnapshot } from "@/lib/telemetry/simulator";

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
    select: { id: true, name: true, timezone: true, mode: true, status: true, arrays: { where: { archivedAt: null, status: "ACTIVE" }, select: { panelCount: true, ratedPowerW: true } } },
  });

  if (!site) {
    return NextResponse.json(
      { error: { code: "not_found", message: "Solar site was not found." } },
      { status: 404 },
    );
  }

  return NextResponse.json(
    {
      data: createTelemetrySnapshot({ ...site, installedCapacityW: site.arrays.reduce((sum, array) => sum + array.panelCount * array.ratedPowerW, 0) || undefined }),
      meta: { refreshAfterSeconds: 15 },
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
