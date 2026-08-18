import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import { findConfigurableSite } from "@/lib/configuration/site-access";
import { issuesMessage, solarArraySchema } from "@/lib/configuration/validation";
import { db } from "@/lib/db";

export async function POST(request: Request, { params }: { params: Promise<{ siteId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: { code: "unauthorized", message: "Authentication is required." } }, { status: 401 });

  const { siteId } = await params;
  if (!await findConfigurableSite(user, siteId)) return NextResponse.json({ error: { code: "not_found", message: "Solar site was not found." } }, { status: 404 });

  const parsed = solarArraySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: { code: "validation_error", message: issuesMessage(parsed.error) } }, { status: 422 });

  try {
    const array = await db.solarArray.create({ data: { siteId, ...parsed.data }, select: { id: true, name: true, panelCount: true, ratedPowerW: true, status: true, createdAt: true } });
    return NextResponse.json({ data: array }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: { code: "duplicate_name", message: "An array with this name already exists at this site." } }, { status: 409 });
    }
    throw error;
  }
}
