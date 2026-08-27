import { describe, expect, it } from "vitest";

import {
  gatewayHeartbeatSchema,
  telemetryBatchSchema,
  validateGatewayTimestamp,
  validateTelemetryTiming,
} from "@/lib/gateway/contract";
import { deriveConnectivityStatus } from "@/lib/gateway/status";

const sentAt = "2026-08-11T10:30:00.000Z";

const validBatch = {
  schemaVersion: "1.0",
  batchId: "0d8a0ca8-aa9b-4813-b5ba-0e4a134cc2a1",
  gatewayId: "gateway_demo",
  sequence: 42,
  sentAt,
  source: "VIRTUAL",
  siteSnapshot: {
    observedAt: sentAt,
    pvPowerW: 4200,
    pvEnergyTodayWh: 18100,
    loadPowerW: 2500,
    gridPowerW: -900,
    batteryPowerW: -800,
    batterySocPct: 72,
    dcVoltageV: 385.4,
    dcCurrentA: 10.9,
    acVoltageV: 231.2,
    acCurrentA: 18.2,
    gridVoltageV: 230.8,
    frequencyHz: 50,
    inverterTemperatureC: 43.1,
    panelTemperatureC: 48.6,
    irradianceWm2: 812,
    deviceStatus: "NORMAL",
  },
  devices: [
    {
      externalId: "array-east",
      kind: "PV_ARRAY",
      name: "East roof",
      reportedAt: sentAt,
      lastTelemetryAt: sentAt,
      connectivityStatus: "ONLINE",
      operationalState: "RUNNING",
      quality: "SIMULATED",
      metrics: { powerW: 2100, efficiencyPct: 92 },
    },
    {
      externalId: "inverter-main",
      kind: "INVERTER",
      name: "Main inverter",
      reportedAt: sentAt,
      lastTelemetryAt: sentAt,
      connectivityStatus: "ONLINE",
      operationalState: "RUNNING",
      quality: "SIMULATED",
      metrics: { acPowerW: 4200, temperatureC: 43.1 },
    },
  ],
};

describe("gateway telemetry contract", () => {
  it("accepts a versioned, balanced batch from an enrolled gateway", () => {
    const result = telemetryBatchSchema.safeParse(validBatch);

    expect(result.success).toBe(true);
  });

  it("rejects a snapshot whose power flows do not balance", () => {
    const result = telemetryBatchSchema.safeParse({
      ...validBatch,
      siteSnapshot: { ...validBatch.siteSnapshot, gridPowerW: 1200 },
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues.some((issue) => issue.path.includes("gridPowerW"))).toBe(true);
  });

  it("keeps device communications separate from operating state", () => {
    const result = telemetryBatchSchema.parse({
      ...validBatch,
      devices: [
        {
          ...validBatch.devices[0],
          connectivityStatus: "ONLINE",
          operationalState: "STOPPED",
          metrics: { powerW: 0, efficiencyPct: 92 },
        },
      ],
    });

    expect(result.devices[0].connectivityStatus).toBe("ONLINE");
    expect(result.devices[0].operationalState).toBe("STOPPED");
  });

  it("rejects buffered telemetry outside the bounded replay window", () => {
    expect(validateTelemetryTiming(validBatch, new Date("2026-08-19T10:30:01.000Z"))).toMatchObject({
      code: "sent_at_too_old",
    });
    expect(validateTelemetryTiming(validBatch, new Date("2026-08-11T10:27:59.000Z"))).toMatchObject({
      code: "sent_at_in_future",
    });
    expect(validateTelemetryTiming(validBatch, new Date("2026-08-11T10:30:01.000Z"))).toBeNull();
  });
});

describe("gateway heartbeat contract", () => {
  const heartbeat = {
    schemaVersion: "1.0",
    heartbeatId: "52bcdd2b-cc48-4677-aac4-f987789724f5",
    gatewayId: "gateway_demo",
    sentAt,
    softwareVersion: "0.2.0",
    publishingEnabled: false,
    publishIntervalSec: 60,
    queueDepth: 3,
    deviceCount: 7,
  };

  it("accepts gateway health independently from telemetry publishing", () => {
    expect(gatewayHeartbeatSchema.parse(heartbeat)).toMatchObject({
      publishingEnabled: false,
      publishIntervalSec: 60,
      queueDepth: 3,
    });
  });

  it("rejects a publish cadence outside the supported gateway interval", () => {
    expect(gatewayHeartbeatSchema.safeParse({ ...heartbeat, publishIntervalSec: 5 }).success).toBe(false);
    expect(gatewayHeartbeatSchema.safeParse({ ...heartbeat, publishIntervalSec: 3_601 }).success).toBe(false);
  });

  it("limits heartbeat clock skew", () => {
    expect(validateGatewayTimestamp(sentAt, new Date("2026-08-11T10:34:59.000Z"), 5 * 60)).toBeNull();
    expect(validateGatewayTimestamp(sentAt, new Date("2026-08-11T10:35:01.000Z"), 5 * 60)?.code).toBe("sent_at_too_old");
    expect(validateGatewayTimestamp(sentAt, new Date("2026-08-11T10:27:59.000Z"), 5 * 60)?.code).toBe("sent_at_in_future");
  });
});

describe("connectivity freshness", () => {
  const now = new Date("2026-08-11T10:40:00.000Z");

  it("distinguishes never-seen, online, stale, and offline equipment", () => {
    expect(deriveConnectivityStatus(null, 30, now)).toBe("NEVER_SEEN");
    expect(deriveConnectivityStatus(new Date("2026-08-11T10:39:30.000Z"), 30, now)).toBe("ONLINE");
    expect(deriveConnectivityStatus(new Date("2026-08-11T10:37:30.000Z"), 30, now)).toBe("STALE");
    expect(deriveConnectivityStatus(new Date("2026-08-11T10:30:00.000Z"), 30, now)).toBe("OFFLINE");
  });
});
