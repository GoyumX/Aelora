import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { gatewayEnrollmentSchema } from "@/lib/gateway/contract";
import { createGatewaySecret, hashGatewaySecret } from "@/lib/gateway/credentials";

export async function POST(request: Request) {
  const parsed = gatewayEnrollmentSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: { code: "validation_error", message: "A valid enrollment token and software version are required." } }, { status: 422 });
  }

  const enrollmentTokenHash = hashGatewaySecret(parsed.data.enrollmentToken);
  const pendingGateway = await db.edgeGateway.findUnique({
    where: { enrollmentTokenHash },
    select: { id: true, enrollmentExpiresAt: true, revokedAt: true, expectedIntervalSec: true },
  });
  if (!pendingGateway || pendingGateway.revokedAt || !pendingGateway.enrollmentExpiresAt || pendingGateway.enrollmentExpiresAt <= new Date()) {
    return NextResponse.json({ error: { code: "invalid_enrollment", message: "The enrollment token is invalid or has expired." } }, { status: 401 });
  }

  const credential = createGatewaySecret("credential");
  const enrolledAt = new Date();
  const claimed = await db.edgeGateway.updateMany({
    where: { id: pendingGateway.id, enrollmentTokenHash, revokedAt: null },
    data: {
      credentialHash: hashGatewaySecret(credential),
      enrollmentTokenHash: null,
      enrollmentExpiresAt: null,
      softwareVersion: parsed.data.softwareVersion,
      enrolledAt,
      status: "OFFLINE",
    },
  });
  if (claimed.count !== 1) {
    return NextResponse.json({ error: { code: "invalid_enrollment", message: "The enrollment token has already been used." } }, { status: 401 });
  }

  return NextResponse.json({
    data: {
      gatewayId: pendingGateway.id,
      credential,
      expectedIntervalSec: pendingGateway.expectedIntervalSec,
      telemetryPath: `/api/v1/gateways/${pendingGateway.id}/telemetry-batches`,
      heartbeatPath: `/api/v1/gateways/${pendingGateway.id}/heartbeats`,
      enrolledAt: enrolledAt.toISOString(),
    },
  }, { headers: { "Cache-Control": "private, no-store" } });
}
