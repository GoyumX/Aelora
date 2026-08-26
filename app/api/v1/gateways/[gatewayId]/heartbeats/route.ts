import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { authenticateGateway } from "@/lib/gateway/authentication";
import { gatewayHeartbeatSchema, validateGatewayTimestamp } from "@/lib/gateway/contract";
import { readBearerToken } from "@/lib/gateway/credentials";

function unauthorized() {
  return NextResponse.json(
    { error: { code: "unauthorized_gateway", message: "A valid gateway bearer credential is required." } },
    { status: 401, headers: { "WWW-Authenticate": "Bearer" } },
  );
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ gatewayId: string }> },
) {
  const credential = readBearerToken(request.headers.get("authorization"));
  if (!credential) return unauthorized();

  const { gatewayId } = await params;
  const receivedAt = new Date();
  const gateway = await authenticateGateway(gatewayId, credential, receivedAt);
  if (!gateway) return unauthorized();

  const parsed = gatewayHeartbeatSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "validation_error", message: parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ") } },
      { status: 422 },
    );
  }
  if (parsed.data.gatewayId !== gateway.id) {
    return NextResponse.json(
      { error: { code: "gateway_mismatch", message: "Payload gatewayId does not match its credential." } },
      { status: 403 },
    );
  }

  const timingIssue = validateGatewayTimestamp(
    parsed.data.sentAt,
    receivedAt,
    Math.max(5 * 60, gateway.expectedIntervalSec * 10),
  );
  if (timingIssue) {
    return NextResponse.json(
      { error: { code: timingIssue.code, message: timingIssue.message } },
      { status: 422 },
    );
  }

  const existing = await db.gatewayHeartbeat.findUnique({
    where: { gatewayId_heartbeatId: { gatewayId, heartbeatId: parsed.data.heartbeatId } },
    select: { heartbeatId: true, receivedAt: true },
  });
  if (existing) {
    const expectedIntervalSec = parsed.data.publishIntervalSec ?? gateway.expectedIntervalSec;
    return NextResponse.json({
      data: {
        heartbeatId: existing.heartbeatId,
        accepted: true,
        duplicate: true,
        receivedAt: existing.receivedAt.toISOString(),
        expectedIntervalSec,
      },
    });
  }

  try {
    const expectedIntervalSec = parsed.data.publishIntervalSec ?? gateway.expectedIntervalSec;
    await db.$transaction([
      db.gatewayHeartbeat.create({
        data: {
          gatewayId,
          heartbeatId: parsed.data.heartbeatId,
          sentAt: new Date(parsed.data.sentAt),
          receivedAt,
          softwareVersion: parsed.data.softwareVersion,
          publishingEnabled: parsed.data.publishingEnabled,
          queueDepth: parsed.data.queueDepth,
          deviceCount: parsed.data.deviceCount,
        },
      }),
      db.edgeGateway.update({
        where: { id: gatewayId },
        data: {
          status: "ONLINE",
          lastSeenAt: receivedAt,
          lastHeartbeatAt: receivedAt,
          softwareVersion: parsed.data.softwareVersion,
          expectedIntervalSec,
        },
      }),
    ]);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({
        data: { heartbeatId: parsed.data.heartbeatId, accepted: true, duplicate: true, receivedAt: receivedAt.toISOString() },
      });
    }
    throw error;
  }

  return NextResponse.json(
    { data: { heartbeatId: parsed.data.heartbeatId, accepted: true, duplicate: false, receivedAt: receivedAt.toISOString(), expectedIntervalSec: parsed.data.publishIntervalSec ?? gateway.expectedIntervalSec } },
    {
      status: 201,
      headers: {
        "Cache-Control": "no-store",
        Location: `/api/v1/gateways/${gatewayId}/heartbeats/${parsed.data.heartbeatId}`,
      },
    },
  );
}
