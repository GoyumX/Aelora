import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import { findConfigurableSite } from "@/lib/configuration/site-access";
import { inverterConfigurationSchema, issuesMessage } from "@/lib/configuration/validation";
import { db } from "@/lib/db";

export async function PUT(request: Request, { params }: { params: Promise<{ siteId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: { code: "unauthorized", message: "Authentication is required." } }, { status: 401 });

  const { siteId } = await params;
  if (!await findConfigurableSite(user, siteId)) return NextResponse.json({ error: { code: "not_found", message: "Solar site was not found." } }, { status: 404 });

  const parsed = inverterConfigurationSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: { code: "validation_error", message: issuesMessage(parsed.error) } }, { status: 422 });

  const existing = await db.inverter.findFirst({ where: { siteId, archivedAt: null }, orderBy: { createdAt: "asc" }, select: { id: true } });
  const inverter = existing
    ? await db.inverter.update({ where: { id: existing.id }, data: parsed.data, select: { id: true, manufacturer: true, model: true, acRatingW: true, communicationAdapter: true, updatedAt: true } })
    : await db.inverter.create({ data: { siteId, ...parsed.data }, select: { id: true, manufacturer: true, model: true, acRatingW: true, communicationAdapter: true, updatedAt: true } });
  return NextResponse.json({ data: inverter }, { status: existing ? 200 : 201 });
}
