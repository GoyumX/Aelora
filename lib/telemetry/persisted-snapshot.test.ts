import { describe, expect, it } from "vitest";

import { createPersistedTelemetrySnapshot } from "@/lib/telemetry/persisted-snapshot";

const reading = {
  observedAt: new Date("2026-08-11T10:30:00.000Z"),
  source: "SIMULATOR" as const,
  quality: "SIMULATED" as const,
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

describe("persisted telemetry snapshot", () => {
  it("returns the stored reading and reports fresh gateway equipment online", () => {
    const result = createPersistedTelemetrySnapshot({
      site: { id: "site-1", name: "Colombo Home" },
      reading,
      recentReadings: [reading],
      gateway: {
        id: "gateway-1",
        name: "Virtual plant",
        lastSeenAt: new Date("2026-08-11T10:30:00.000Z"),
        expectedIntervalSec: 30,
        devices: [{
          externalId: "array-east",
          name: "East roof",
          kind: "PV_ARRAY",
          connectivityStatus: "ONLINE",
          operationalState: "RUNNING",
          lastSeenAt: new Date("2026-08-11T10:30:00.000Z"),
          expectedIntervalSec: 30,
          metrics: { powerW: 2200 },
        }],
      },
      now: new Date("2026-08-11T10:30:30.000Z"),
    });

    expect(result.pvPowerW).toBe(4200);
    expect(result.gridPowerW).toBe(-900);
    expect(result.connectivity.gateway.status).toBe("ONLINE");
    expect(result.connectivity.devices[0].status).toBe("ONLINE");
    expect(result.arrays[0]).toMatchObject({ id: "array-east", powerW: 2200, status: "NORMAL" });
  });

  it("ages last-known online state to stale without inventing a new reading", () => {
    const result = createPersistedTelemetrySnapshot({
      site: { id: "site-1", name: "Colombo Home" },
      reading,
      recentReadings: [reading],
      gateway: {
        id: "gateway-1",
        name: "Virtual plant",
        lastSeenAt: new Date("2026-08-11T10:28:00.000Z"),
        expectedIntervalSec: 30,
        devices: [],
      },
      now: new Date("2026-08-11T10:30:30.000Z"),
    });

    expect(result.observedAt).toBe("2026-08-11T10:30:00.000Z");
    expect(result.connectivity.gateway.status).toBe("STALE");
    expect(result.quality).toBe("STALE");
  });

  it("handles a site with no enrolled gateway without inventing devices or array power", () => {
    const result = createPersistedTelemetrySnapshot({
      site: { id: "site-1", name: "Colombo Home" },
      reading: { ...reading, deviceStatus: "VENDOR_SPECIFIC_STATUS" },
      recentReadings: [],
      gateway: null,
      now: new Date("2026-08-11T10:30:30.000Z"),
    });

    expect(result.connectivity.gateway).toMatchObject({ id: null, status: "NEVER_SEEN", lastSeenAt: null });
    expect(result.connectivity.devices).toEqual([]);
    expect(result.arrays).toEqual([]);
    expect(result.deviceStatus).toBe("NORMAL");
    expect(result.quality).toBe("STALE");
  });

  it("prefers an explicit offline device state and safely ignores non-numeric metrics", () => {
    const result = createPersistedTelemetrySnapshot({
      site: { id: "site-1", name: "Colombo Home" },
      reading,
      recentReadings: [reading],
      gateway: {
        id: "gateway-1",
        name: "Virtual plant",
        lastSeenAt: new Date("2026-08-11T10:30:00.000Z"),
        expectedIntervalSec: 30,
        devices: [{
          externalId: "array-east",
          name: "East roof",
          kind: "PV_ARRAY",
          connectivityStatus: "OFFLINE",
          operationalState: "UNKNOWN",
          lastSeenAt: null,
          expectedIntervalSec: 30,
          metrics: { powerW: "missing" },
        }],
      },
      now: new Date("2026-08-11T10:30:30.000Z"),
    });

    expect(result.connectivity.devices[0].status).toBe("OFFLINE");
    expect(result.arrays[0]).toMatchObject({ powerW: 0, status: "OFFLINE" });
  });
});
