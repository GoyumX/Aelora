import { NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { createGatewaySecret, hashGatewaySecret } from "@/lib/gateway/credentials";

const createGatewaySchema = z.object({
  name: z.string().trim().min(2).max(120),
  mode: z.enum(["VIRTUAL", "HARDWARE"]).default("VIRTUAL"),
  expectedIntervalSec: z.coerce.number().int().min(10).max(3600).default(30),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ siteId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: { code: "unauthorized", message: "Authentication is required." } }, { status: 401 });
  }

  const { siteId } = await params;
  const site = await db.solarSite.findFirst({
    where: { id: siteId, deletedAt: null, ...(user.role === "ADMIN" ? {} : { ownerId: user.id }) },
    select: { id: true },
  });
  if (!site) {
    return NextResponse.json({ error: { code: "not_found", message: "Solar site was not found." } }, { status: 404 });
  }

  const parsed = createGatewaySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "validation_error", message: parsed.error.issues.map((issue) => issue.message).join("; ") } },
      { status: 422 },
    );
  }

  const enrollmentToken = createGatewaySecret("enroll");
  const enrollmentExpiresAt = new Date(Date.now() + 30 * 60 * 1000);
  const gateway = await db.edgeGateway.create({
    data: {
      siteId,
      name: parsed.data.name,
      mode: parsed.data.mode,
      expectedIntervalSec: parsed.data.expectedIntervalSec,
      enrollmentTokenHash: hashGatewaySecret(enrollmentToken),
      enrollmentExpiresAt,
    },
    select: { id: true, gatewayUid: true, name: true, mode: true, status: true, expectedIntervalSec: true },
  });

  return NextResponse.json(
    { data: { ...gateway, enrollmentToken, enrollmentExpiresAt: enrollmentExpiresAt.toISOString() } },
    { status: 201, headers: { "Cache-Control": "private, no-store" } },
  );
}
