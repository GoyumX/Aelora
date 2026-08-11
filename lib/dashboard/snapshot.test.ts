import { describe, expect, it } from "vitest";

import { createDashboardSnapshot, createDashboardSnapshotFromTelemetry } from "@/lib/dashboard/snapshot";
import { createTelemetrySnapshot } from "@/lib/telemetry/simulator";

const site = {
  id: "site-demo",
  name: "Colombo Home",
  mode: "SIMULATED" as const,
  status: "ACTIVE" as const,
  timezone: "Asia/Colombo",
};

describe("dashboard simulation snapshot", () => {
  it("is deterministic for the same site and observation time", () => {
    const observedAt = new Date("2026-08-07T06:30:00.000Z");

    expect(createDashboardSnapshot(site, observedAt)).toEqual(
      createDashboardSnapshot(site, observedAt),
    );
  });

  it("maintains the documented energy balance and safe battery bounds", () => {
    const snapshot = createDashboardSnapshot(site, new Date("2026-08-07T06:30:00.000Z"));
    const { batteryPowerKw, gridPowerKw, loadPowerKw, pvPowerKw, batterySocPct } = snapshot.metrics;

    expect(pvPowerKw + batteryPowerKw + gridPowerKw).toBeCloseTo(loadPowerKw, 2);
    expect(batterySocPct).toBeGreaterThanOrEqual(10);
    expect(batterySocPct).toBeLessThanOrEqual(100);
  });

  it("provides an intraday trend and exactly two forecast summary days", () => {
    const snapshot = createDashboardSnapshot(site, new Date("2026-08-07T06:30:00.000Z"));

    expect(snapshot.intraday).toHaveLength(13);
    expect(snapshot.forecast).toHaveLength(2);
    expect(snapshot.forecast.every((day) => day.predictedEnergyKwh > 0)).toBe(true);
  });

  it("maps fresh persisted virtual telemetry without fabricating a forecast", () => {
    const telemetry = createTelemetrySnapshot(site, new Date("2026-08-07T06:30:00.000Z"));
    telemetry.connectivity.gateway = { id: "gateway-1", name: "Virtual plant", status: "ONLINE", lastSeenAt: telemetry.observedAt, expectedIntervalSec: 30 };
    telemetry.irradianceWm2 = 700;

    const snapshot = createDashboardSnapshotFromTelemetry(site, telemetry);

    expect(snapshot.sourceLabel).toBe("Virtual gateway telemetry");
    expect(snapshot.connectivityStatus).toBe("ONLINE");
    expect(snapshot.metrics.weather.condition).toBe("Strong sunlight");
    expect(snapshot.forecast).toEqual([]);
    expect(snapshot.alert.severity).toBe("INFO");
  });

  it("labels stale hardware and low irradiance as last-known operational data", () => {
    const telemetry = createTelemetrySnapshot({ ...site, mode: "HARDWARE" }, new Date("2026-08-07T18:30:00.000Z"));
    telemetry.connectivity.gateway = { id: "gateway-2", name: "Hardware plant", status: "STALE", lastSeenAt: telemetry.observedAt, expectedIntervalSec: 30 };
    telemetry.irradianceWm2 = 50;

    const snapshot = createDashboardSnapshotFromTelemetry({ ...site, mode: "HARDWARE" }, telemetry);

    expect(snapshot.sourceLabel).toBe("Hardware gateway telemetry");
    expect(snapshot.metrics.weather.condition).toBe("Low irradiance");
    expect(snapshot.alert).toMatchObject({ severity: "WARNING", title: "Gateway is stale" });
  });
});
