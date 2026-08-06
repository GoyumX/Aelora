import { describe, expect, it } from "vitest";

import { createDashboardSnapshot } from "@/lib/dashboard/snapshot";

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
});
