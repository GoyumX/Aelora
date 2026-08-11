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

export const gatewayEnrollmentSchema = z.object({
  enrollmentToken: z.string().min(32).max(256),
  softwareVersion: z.string().trim().min(1).max(80),
});

export type TelemetryBatchInput = z.infer<typeof telemetryBatchSchema>;
export type GatewayDeviceObservationInput = z.infer<typeof gatewayDeviceObservationSchema>;
