import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import { findConfigurableSite } from "@/lib/configuration/site-access";
import { issuesMessage, siteConfigurationSchema } from "@/lib/configuration/validation";
import { db } from "@/lib/db";

export async function PATCH(request: Request, { params }: { params: Promise<{ siteId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: { code: "unauthorized", message: "Authentication is required." } }, { status: 401 });

  const { siteId } = await params;
  if (!await findConfigurableSite(user, siteId)) return NextResponse.json({ error: { code: "not_found", message: "Solar site was not found." } }, { status: 404 });

  const parsed = siteConfigurationSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: { code: "validation_error", message: issuesMessage(parsed.error) } }, { status: 422 });

  const site = await db.solarSite.update({
    where: { id: siteId },
    data: parsed.data,
    select: { id: true, name: true, latitude: true, longitude: true, timezone: true, mode: true, status: true, updatedAt: true },
  });
  return NextResponse.json({ data: site });
}
