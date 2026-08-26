import { NextResponse } from "next/server";

import { runIncrementalTelemetryRollups } from "@/lib/telemetry/rollup-service";
import { isWeatherSyncAuthorized } from "@/lib/weather/sync-auth";

export async function POST(request: Request) {
  if (!isWeatherSyncAuthorized(request.headers.get("authorization"))) {
    return NextResponse.json(
      { error: { code: "unauthorized", message: "A valid scheduler bearer secret is required." } },
      { status: 401, headers: { "WWW-Authenticate": "Bearer" } },
    );
  }

  const result = await runIncrementalTelemetryRollups();
  return NextResponse.json({ data: result }, { headers: { "Cache-Control": "no-store" } });
}
