import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import { getLatestSiteForecast } from "@/lib/forecast/forecast-service";

const noStoreHeaders = { "Cache-Control": "private, no-store" };

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ siteId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: { code: "unauthorized", message: "Authentication is required." } },
      { status: 401, headers: noStoreHeaders },
    );
  }

  const { siteId } = await params;
  const forecast = await getLatestSiteForecast(
    { id: user.id, role: user.role },
    siteId,
  );
  if (!forecast) {
    return NextResponse.json(
      { error: { code: "not_found", message: "No stored forecast was found." } },
      { status: 404, headers: noStoreHeaders },
    );
  }
  return NextResponse.json({ data: forecast }, { headers: noStoreHeaders });
}
