import { NextResponse } from "next/server";

import { isWeatherSyncAuthorized } from "@/lib/weather/sync-auth";
import { syncAllActiveSiteWeather } from "@/lib/weather/weather-service";

export async function POST(request: Request) {
  if (!isWeatherSyncAuthorized(request.headers.get("authorization"))) {
    return NextResponse.json(
      { error: { code: "unauthorized", message: "A valid weather sync bearer secret is required." } },
      { status: 401, headers: { "WWW-Authenticate": "Bearer" } },
    );
  }

  const result = await syncAllActiveSiteWeather();
  return NextResponse.json(
    { data: result },
    { headers: { "Cache-Control": "no-store" } },
  );
}
