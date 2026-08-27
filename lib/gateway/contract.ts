import { z } from "zod";

import { connectivityStatuses } from "@/lib/gateway/status";

export const gatewaySources = ["VIRTUAL", "HARDWARE"] as const;
export const gatewayDeviceKinds = [
  "PV_ARRAY",
  "INVERTER",
  "BATTERY",
  "GRID_METER",
  "LOAD_METER",
  "WEATHER_SENSOR",
] as const;
export const deviceOperationalStates = ["UNKNOWN", "RUNNING", "STANDBY", "STOPPED", "FAULT"] as const;

const finiteNumber = z.number().finite();
const timestamp = z.string().datetime({ offset: true });
const metricValue = z.union([finiteNumber, z.string().max(160), z.boolean(), z.null()]);

export const gatewayDeviceObservationSchema = z.object({
  externalId: z.string().trim().min(1).max(120),
  kind: z.enum(gatewayDeviceKinds),
  name: z.string().trim().min(1).max(120),
  manufacturer: z.string().trim().max(120).optional(),
  model: z.string().trim().max(120).optional(),
  serialNumber: z.string().trim().max(160).optional(),
  reportedAt: timestamp,
  lastTelemetryAt: timestamp.nullable(),
  connectivityStatus: z.enum(connectivityStatuses),
  operationalState: z.enum(deviceOperationalStates),
  quality: z.enum(["SIMULATED", "MEASURED", "ESTIMATED", "STALE", "MISSING"]),
  metrics: z.record(z.string().max(80), metricValue).default({}),
});

export const siteTelemetrySnapshotSchema = z.object({
  observedAt: timestamp,
  pvPowerW: finiteNumber.nonnegative(),
  pvEnergyTodayWh: finiteNumber.nonnegative(),
  loadPowerW: finiteNumber.nonnegative(),
  gridPowerW: finiteNumber,
  batteryPowerW: finiteNumber,
  batterySocPct: finiteNumber.min(0).max(100),
  dcVoltageV: finiteNumber.nonnegative(),
  dcCurrentA: finiteNumber.nonnegative(),
  acVoltageV: finiteNumber.nonnegative(),
  acCurrentA: finiteNumber.nonnegative(),
  gridVoltageV: finiteNumber.nonnegative(),
  frequencyHz: finiteNumber.nonnegative().max(100),
  inverterTemperatureC: finiteNumber.min(-80).max(250),
  panelTemperatureC: finiteNumber.min(-80).max(250),
  irradianceWm2: finiteNumber.nonnegative().max(2000),
  deviceStatus: z.string().trim().min(1).max(80),
}).superRefine((snapshot, context) => {
  // Sign convention: battery > 0 is discharge, grid > 0 is import.
  const imbalanceW = Math.abs(
    snapshot.pvPowerW + snapshot.batteryPowerW + snapshot.gridPowerW - snapshot.loadPowerW,
  );
  const toleranceW = Math.max(50, snapshot.loadPowerW * 0.03);
  if (imbalanceW > toleranceW) {
    context.addIssue({
      code: "custom",
      message: `Power balance differs by ${Math.round(imbalanceW)} W (allowed ${Math.round(toleranceW)} W).`,
      path: ["gridPowerW"],
    });
  }
});

export const telemetryBatchSchema = z.object({
  schemaVersion: z.literal("1.0"),
  batchId: z.string().uuid(),
  gatewayId: z.string().trim().min(1).max(120),
  sequence: z.number().int().nonnegative(),
  sentAt: timestamp,
  source: z.enum(gatewaySources),
  siteSnapshot: siteTelemetrySnapshotSchema,
  devices: z.array(gatewayDeviceObservationSchema).min(1).max(256),
});

export const gatewayHeartbeatSchema = z.object({
  schemaVersion: z.literal("1.0"),
  heartbeatId: z.string().uuid(),
  gatewayId: z.string().trim().min(1).max(120),
  sentAt: timestamp,
  softwareVersion: z.string().trim().min(1).max(80),
  publishingEnabled: z.boolean(),
  publishIntervalSec: z.number().int().min(10).max(3_600).optional(),
  queueDepth: z.number().int().nonnegative().max(100_000),
  deviceCount: z.number().int().nonnegative().max(256),
});

export const gatewayEnrollmentSchema = z.object({
  enrollmentToken: z.string().min(32).max(256),
  softwareVersion: z.string().trim().min(1).max(80),
});

export type TelemetryBatchInput = z.infer<typeof telemetryBatchSchema>;
export type GatewayDeviceObservationInput = z.infer<typeof gatewayDeviceObservationSchema>;
export type GatewayHeartbeatInput = z.infer<typeof gatewayHeartbeatSchema>;

export type GatewayTimingIssue = {
  code: "sent_at_too_old" | "sent_at_in_future" | "timestamp_invalid";
  message: string;
  path: string;
};

const maxFutureSkewSec = 2 * 60;
const telemetryReplayWindowSec = 7 * 24 * 60 * 60;

export function validateGatewayTimestamp(
  value: string,
  now: Date,
  maxAgeSec: number,
  path = "sentAt",
): GatewayTimingIssue | null {
  const timestampMs = new Date(value).getTime();
  if (!Number.isFinite(timestampMs)) {
    return { code: "timestamp_invalid", message: `${path} is not a valid timestamp.`, path };
  }
  if (timestampMs - now.getTime() > maxFutureSkewSec * 1000) {
    return { code: "sent_at_in_future", message: `${path} is too far in the future.`, path };
  }
  if (now.getTime() - timestampMs > maxAgeSec * 1000) {
    return { code: "sent_at_too_old", message: `${path} is outside the accepted replay window.`, path };
  }
  return null;
}

export function validateTelemetryTiming(
  batch: {
    sentAt: string;
    siteSnapshot: { observedAt: string };
    devices: Array<{ reportedAt: string; lastTelemetryAt?: string | null }>;
  },
  now: Date,
): GatewayTimingIssue | null {
  const timestamps = [
    { value: batch.sentAt, path: "sentAt" },
    { value: batch.siteSnapshot.observedAt, path: "siteSnapshot.observedAt" },
    ...batch.devices.map((device, index) => ({ value: device.reportedAt, path: `devices.${index}.reportedAt` })),
    ...batch.devices.flatMap((device, index) => device.lastTelemetryAt
      ? [{ value: device.lastTelemetryAt, path: `devices.${index}.lastTelemetryAt` }]
      : []),
  ];
  for (const item of timestamps) {
    const issue = validateGatewayTimestamp(item.value, now, telemetryReplayWindowSec, item.path);
    if (issue) return issue;
  }
  return null;
}
