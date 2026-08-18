import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { authenticateGateway } from "@/lib/gateway/authentication";
import { telemetryBatchSchema, validateTelemetryTiming } from "@/lib/gateway/contract";
import { readBearerToken } from "@/lib/gateway/credentials";
import { buildDevicePersistence, buildReadingPersistence } from "@/lib/gateway/ingestion-mapper";

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

  const parsed = telemetryBatchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "validation_error", message: parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ") } },
      { status: 422 },
    );
  }
  if (parsed.data.gatewayId !== gateway.id) {
    return NextResponse.json({ error: { code: "gateway_mismatch", message: "Payload gatewayId does not match its credential." } }, { status: 403 });
  }
  if (parsed.data.source !== gateway.mode) {
    return NextResponse.json({ error: { code: "source_mismatch", message: "Payload source does not match the enrolled gateway mode." } }, { status: 403 });
  }
  const timingIssue = validateTelemetryTiming(parsed.data, receivedAt);
  if (timingIssue) {
    return NextResponse.json(
      { error: { code: timingIssue.code, message: timingIssue.message } },
      { status: 422 },
    );
  }

  const existing = await db.telemetryBatch.findFirst({
    where: { gatewayId, OR: [{ batchId: parsed.data.batchId }, { sequence: parsed.data.sequence }] },
    select: { id: true, batchId: true, sequence: true, receivedAt: true },
  });
  if (existing) {
    if (existing.batchId !== parsed.data.batchId || existing.sequence !== parsed.data.sequence) {
      return NextResponse.json({ error: { code: "sequence_conflict", message: "This sequence or batch ID was already used by a different batch." } }, { status: 409 });
    }
    return NextResponse.json({ data: { batchId: existing.batchId, accepted: true, duplicate: true, receivedAt: existing.receivedAt.toISOString() } });
  }

  try {
    await db.$transaction(async (transaction) => {
      const batch = await transaction.telemetryBatch.create({
        data: {
          gatewayId,
          batchId: parsed.data.batchId,
          sequence: parsed.data.sequence,
          sentAt: new Date(parsed.data.sentAt),
          source: parsed.data.source,
          receivedAt,
        },
      });

      for (const observation of parsed.data.devices) {
        const deviceData = buildDevicePersistence(observation);
        const device = await transaction.gatewayDevice.upsert({
          where: { gatewayId_externalId: { gatewayId, externalId: deviceData.externalId } },
          create: {
            gatewayId,
            ...deviceData,
            expectedIntervalSec: gateway.expectedIntervalSec,
            metrics: deviceData.metrics as Prisma.InputJsonValue,
          },
          update: {
            kind: deviceData.kind,
            name: deviceData.name,
            manufacturer: deviceData.manufacturer,
            model: deviceData.model,
            serialNumber: deviceData.serialNumber,
            connectivityStatus: deviceData.connectivityStatus,
            operationalState: deviceData.operationalState,
            lastSeenAt: deviceData.lastSeenAt ?? undefined,
            metrics: deviceData.metrics as Prisma.InputJsonValue,
          },
        });
        await transaction.deviceObservation.create({
          data: {
            telemetryBatchId: batch.id,
            deviceId: device.id,
            reportedAt: new Date(observation.reportedAt),
            lastTelemetryAt: observation.lastTelemetryAt ? new Date(observation.lastTelemetryAt) : null,
            quality: observation.quality,
            connectivityStatus: observation.connectivityStatus,
            operationalState: observation.operationalState,
            metrics: observation.metrics as Prisma.InputJsonValue,
          },
        });
      }

      await transaction.telemetryReading.create({
        data: {
          siteId: gateway.siteId,
          gatewayId,
          telemetryBatchId: batch.id,
          ...buildReadingPersistence(parsed.data.siteSnapshot, parsed.data.source),
        },
      });
      await transaction.edgeGateway.update({
        where: { id: gatewayId },
        data: {
          status: "ONLINE",
          lastSeenAt: receivedAt,
          lastTelemetryAt: receivedAt,
          lastSequence: parsed.data.sequence,
        },
      });
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: { code: "batch_conflict", message: "The batch conflicts with telemetry already accepted by Aelora." } }, { status: 409 });
    }
    throw error;
  }

  return NextResponse.json(
    { data: { batchId: parsed.data.batchId, accepted: true, duplicate: false, receivedAt: receivedAt.toISOString() } },
    {
      status: 201,
      headers: {
        "Cache-Control": "no-store",
        Location: `/api/v1/gateways/${gatewayId}/telemetry-batches/${parsed.data.batchId}`,
      },
    },
  );
}
