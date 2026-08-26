import { NextResponse } from "next/server";

import { refreshAllStaleSiteForecasts } from "@/lib/forecast/forecast-service";
import { isWeatherSyncAuthorized } from "@/lib/weather/sync-auth";
import { syncAllActiveSiteWeather } from "@/lib/weather/weather-service";

export async function POST(request: Request) {
  if (!isWeatherSyncAuthorized(request.headers.get("authorization"))) {
    return NextResponse.json(
      { error: { code: "unauthorized", message: "A valid intelligence refresh bearer secret is required." } },
      { status: 401, headers: { "WWW-Authenticate": "Bearer" } },
    );
  }

  const now = new Date();
  const weather = await syncAllActiveSiteWeather(now);
  const forecast = await refreshAllStaleSiteForecasts(now);
  return NextResponse.json(
    { data: { weather, forecast } },
    { headers: { "Cache-Control": "no-store" } },
  );
}
