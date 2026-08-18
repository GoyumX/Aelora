import { describe, expect, it } from "vitest";

import { createTelemetrySnapshot } from "@/lib/telemetry/simulator";

const site = {
  id: "site-demo",
  name: "Colombo Home",
  timezone: "Asia/Colombo",
  mode: "SIMULATED" as const,
  status: "ACTIVE" as const,
};
const observedAt = new Date("2026-08-07T06:30:00.000Z");

describe("canonical telemetry simulator", () => {
  it("produces deterministic, balanced normal telemetry", () => {
    const telemetry = createTelemetrySnapshot(site, observedAt, "NORMAL");

    expect(telemetry).toEqual(createTelemetrySnapshot(site, observedAt, "NORMAL"));
    expect(telemetry.source).toBe("SIMULATOR");
    expect(telemetry.quality).toBe("SIMULATED");
    expect(telemetry.pvPowerW + telemetry.batteryPowerW + telemetry.gridPowerW).toBeCloseTo(telemetry.loadPowerW, 0);
    expect(telemetry.series).toHaveLength(13);
    expect(telemetry.arrays).toHaveLength(2);
  });

  it("models a grid outage without presenting grid voltage or grid flow", () => {
    const telemetry = createTelemetrySnapshot(site, observedAt, "GRID_OUTAGE");

    expect(telemetry.deviceStatus).toBe("GRID_OUTAGE");
    expect(telemetry.gridVoltageV).toBe(0);
    expect(telemetry.gridPowerW).toBe(0);
    expect(telemetry.scenario.message).toMatch(/grid outage/i);
  });

  it("models inverter and battery faults explicitly", () => {
    const inverterFault = createTelemetrySnapshot(site, observedAt, "INVERTER_FAULT");
    const batteryFault = createTelemetrySnapshot(site, observedAt, "BATTERY_FAULT");

    expect(inverterFault.pvPowerW).toBe(0);
    expect(inverterFault.deviceStatus).toBe("INVERTER_FAULT");
    expect(batteryFault.batteryPowerW).toBe(0);
    expect(batteryFault.deviceStatus).toBe("BATTERY_FAULT");
  });

  it("reduces output for cloud and shading scenarios and identifies the affected array", () => {
    const normal = createTelemetrySnapshot(site, observedAt, "NORMAL");
    const cloud = createTelemetrySnapshot(site, observedAt, "SUDDEN_CLOUD");
    const shading = createTelemetrySnapshot(site, observedAt, "PARTIAL_SHADING");

    expect(cloud.pvPowerW).toBeLessThan(normal.pvPowerW);
    expect(cloud.deviceStatus).toBe("CLOUD_RAMP");
    expect(shading.pvPowerW).toBeLessThan(normal.pvPowerW);
    expect(shading.arrays[0].status).toBe("UNDERPERFORMING");
  });

  it("reports zero solar electrical output at night", () => {
    const nighttime = createTelemetrySnapshot(site, new Date("2026-08-07T18:30:00.000Z"));

    expect(nighttime.pvPowerW).toBe(0);
    expect(nighttime.dcVoltageV).toBe(0);
    expect(nighttime.dcCurrentA).toBe(0);
  });

  it("labels a future hardware adapter as measured", () => {
    const hardware = createTelemetrySnapshot({ ...site, mode: "HARDWARE" }, observedAt);

    expect(hardware.source).toBe("HARDWARE");
    expect(hardware.quality).toBe("MEASURED");
  });
});
