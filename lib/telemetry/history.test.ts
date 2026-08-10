import { describe, expect, it } from "vitest";

import { aggregateTelemetry, historyQuerySchema, historyToCsv } from "@/lib/telemetry/history";

const readings = [
  { observedAt: new Date("2026-08-01T00:00:00.000Z"), pvPowerW: 1000, loadPowerW: 800, gridPowerW: -200, batteryPowerW: 0, irradianceWm2: 500, quality: "SIMULATED" as const },
  { observedAt: new Date("2026-08-01T01:00:00.000Z"), pvPowerW: 2000, loadPowerW: 1000, gridPowerW: -800, batteryPowerW: -200, irradianceWm2: 800, quality: "SIMULATED" as const },
  { observedAt: new Date("2026-08-02T00:00:00.000Z"), pvPowerW: 500, loadPowerW: 900, gridPowerW: 400, batteryPowerW: 0, irradianceWm2: 300, quality: "SIMULATED" as const },
];

describe("telemetry history", () => {
  it("validates supported date ranges and grains", () => {
    expect(historyQuerySchema.safeParse({ from: "2026-08-01", to: "2026-08-31", grain: "day" }).success).toBe(true);
    expect(historyQuerySchema.safeParse({ from: "nope", to: "2026-08-31", grain: "minute" }).success).toBe(false);
  });

  it("aggregates power samples into energy and separates grid import/export", () => {
    const result = aggregateTelemetry(readings, "day", "UTC", new Date("2026-08-01T00:00:00.000Z"), new Date("2026-08-03T00:00:00.000Z"), 60);

    expect(result.points).toHaveLength(2);
    expect(result.points[0]).toMatchObject({ generationWh: 3000, consumptionWh: 1800, importWh: 0, exportWh: 1000 });
    expect(result.summary).toMatchObject({ generationWh: 3500, consumptionWh: 2700, importWh: 400, exportWh: 1000 });
    expect(result.completenessPct).toBeCloseTo(6.25);
  });

  it("exports the filtered aggregate with an explicit sign convention", () => {
    const result = aggregateTelemetry(readings, "day", "UTC", new Date("2026-08-01T00:00:00.000Z"), new Date("2026-08-03T00:00:00.000Z"), 60);
    const csv = historyToCsv(result.points);

    expect(csv).toContain("grid_import_kwh,grid_export_kwh");
    expect(csv).toContain("2026-08-01");
  });
});
