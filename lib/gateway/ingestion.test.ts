import { describe, expect, it } from "vitest";

import { buildDevicePersistence, buildReadingPersistence } from "@/lib/gateway/ingestion-mapper";
import type { TelemetryBatchInput } from "@/lib/gateway/contract";

const snapshot: TelemetryBatchInput["siteSnapshot"] = {
  observedAt: "2026-08-11T10:30:00.000Z",
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
};

describe("gateway ingestion persistence mapping", () => {
  it("maps the documented power signs without changing gateway measurements", () => {
    const reading = buildReadingPersistence(snapshot, "VIRTUAL");

    expect(reading.source).toBe("SIMULATOR");
    expect(reading.quality).toBe("SIMULATED");
    expect(reading.gridPowerW).toBe(-900);
    expect(reading.batteryPowerW).toBe(-800);
    expect(reading.observedAt).toEqual(new Date(snapshot.observedAt));
  });

  it("does not advance last-seen time when a device reports communications offline", () => {
    const offline = buildDevicePersistence({
      externalId: "array-east",
      kind: "PV_ARRAY",
      name: "East roof",
      reportedAt: "2026-08-11T10:30:00.000Z",
      lastTelemetryAt: "2026-08-11T10:25:00.000Z",
      connectivityStatus: "OFFLINE",
      operationalState: "UNKNOWN",
      quality: "STALE",
      metrics: { powerW: 0 },
    });

    expect(offline.lastSeenAt).toEqual(new Date("2026-08-11T10:25:00.000Z"));
    expect(offline.connectivityStatus).toBe("OFFLINE");
    expect(offline.operationalState).toBe("UNKNOWN");
  });
});
