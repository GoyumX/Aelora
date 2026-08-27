import { describe, expect, it } from "vitest";

import { buildPerformanceReport, expectedPvPowerW } from "@/lib/performance/performance";

const site = { id: "site-1", name: "Colombo Home", timezone: "Asia/Colombo", source: "SIMULATED" as const };
const arrays = [
  { id: "east-config", name: "East roof", panelCount: 7, ratedPowerW: 440 },
  { id: "west-config", name: "West roof", panelCount: 7, ratedPowerW: 440 },
];
const inverter = { acRatingW: 5_000, efficiencyPct: 96 };

describe("solar performance calculations", () => {
  it("models expected production from configured capacity and stored irradiance with inverter clipping", () => {
    expect(expectedPvPowerW(6_160, 500, inverter)).toBeCloseTo(2_956.8);
    expect(expectedPvPowerW(6_160, 1_000, inverter)).toBe(5_000);
    expect(expectedPvPowerW(6_160, 0, inverter)).toBe(0);
  });

  it("compares actual and expected energy without treating nighttime as underperformance", () => {
    const report = buildPerformanceReport({
      site,
      arrays,
      inverter,
      range: { from: new Date("2026-08-01T00:00:00.000Z"), to: new Date("2026-08-01T03:00:00.000Z") },
      intervalMinutes: 60,
      readings: [
        { observedAt: new Date("2026-08-01T00:00:00.000Z"), pvPowerW: 0, irradianceWm2: 0, quality: "SIMULATED" },
        { observedAt: new Date("2026-08-01T01:00:00.000Z"), pvPowerW: 2_700, irradianceWm2: 500, quality: "SIMULATED" },
        { observedAt: new Date("2026-08-01T02:00:00.000Z"), pvPowerW: 4_700, irradianceWm2: 1_000, quality: "SIMULATED" },
      ],
      arrayObservations: [],
    });

    expect(report.summary.actualGenerationWh).toBe(7_400);
    expect(report.summary.expectedGenerationWh).toBe(7_957);
    expect(report.summary.performanceRatioPct).toBeCloseTo(93, 0);
    expect(report.summary.estimatedLossWh).toBe(557);
    expect(report.points).toHaveLength(1);
  });

  it("uses known numeric device metrics and flags only evidenced array underperformance", () => {
    const readings = [
      { observedAt: new Date("2026-08-01T01:00:00.000Z"), pvPowerW: 3_000, irradianceWm2: 700, quality: "MEASURED" as const },
      { observedAt: new Date("2026-08-01T02:00:00.000Z"), pvPowerW: 3_100, irradianceWm2: 720, quality: "MEASURED" as const },
      { observedAt: new Date("2026-08-01T03:00:00.000Z"), pvPowerW: 3_200, irradianceWm2: 740, quality: "MEASURED" as const },
    ];
    const report = buildPerformanceReport({
      site: { ...site, source: "HARDWARE" },
      arrays,
      inverter,
      range: { from: new Date("2026-08-01T01:00:00.000Z"), to: new Date("2026-08-01T04:00:00.000Z") },
      intervalMinutes: 60,
      readings,
      arrayObservations: readings.flatMap((reading, index) => [
        { externalId: "array-east", name: "East roof", reportedAt: reading.observedAt, connectivityStatus: "ONLINE" as const, operationalState: "RUNNING" as const, metrics: { powerW: 450 + index * 10 } },
        { externalId: "array-west", name: "West roof", reportedAt: reading.observedAt, connectivityStatus: "ONLINE" as const, operationalState: "RUNNING" as const, metrics: { powerW: 2_050 + index * 50 } },
      ]),
    });

    expect(report.sourceLabel).toBe("Measured gateway data");
    expect(report.arrays.find((array) => array.name === "East roof")).toMatchObject({ status: "UNDERPERFORMING", availabilityPct: 100 });
    expect(report.arrays.find((array) => array.name === "West roof")).toMatchObject({ status: "HEALTHY", availabilityPct: 100 });
  });

  it("reports insufficient evidence instead of inventing per-array performance", () => {
    const report = buildPerformanceReport({
      site,
      arrays,
      inverter,
      range: { from: new Date("2026-08-01T00:00:00.000Z"), to: new Date("2026-08-02T00:00:00.000Z") },
      intervalMinutes: 60,
      readings: [],
      arrayObservations: [{ externalId: "array-east", name: "East roof", reportedAt: new Date("2026-08-01T12:00:00.000Z"), connectivityStatus: "ONLINE", operationalState: "RUNNING", metrics: { powerW: "not-a-number" } }],
    });

    expect(report.summary.performanceRatioPct).toBeNull();
    expect(report.arrays.every((array) => array.status === "INSUFFICIENT_DATA")).toBe(true);
  });
});
