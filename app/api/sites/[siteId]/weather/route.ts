import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import { findConfigurableSite } from "@/lib/configuration/site-access";
import { getLatestSiteWeather, syncSiteWeather } from "@/lib/weather/weather-service";

async function authorizedSite(siteId: string): Promise<
  | { ok: true }
  | { ok: false; response: NextResponse }
> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, response: NextResponse.json(
    { error: { code: "unauthorized", message: "Authentication is required." } },
    { status: 401 },
  ) };
  const site = await findConfigurableSite(user, siteId);
  if (!site) return { ok: false, response: NextResponse.json(
    { error: { code: "not_found", message: "Solar site was not found." } },
    { status: 404 },
  ) };
  return { ok: true };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ siteId: string }> },
) {
  const { siteId } = await params;
  const access = await authorizedSite(siteId);
  if (!access.ok) return access.response;

  return NextResponse.json(
    { data: await getLatestSiteWeather(siteId) },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ siteId: string }> },
) {
  const { siteId } = await params;
  const access = await authorizedSite(siteId);
  if (!access.ok) return access.response;

  try {
    const result = await syncSiteWeather(siteId);
    if (!result) {
      return NextResponse.json(
        { error: { code: "site_inactive", message: "Weather can only be refreshed for an active site." } },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { data: result },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: { code: "weather_provider_unavailable", message: "Site settings were saved, but weather refresh is temporarily unavailable." } },
      { status: 502 },
    );
  }
}
