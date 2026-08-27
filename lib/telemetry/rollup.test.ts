import { describe, expect, it } from "vitest";

import {
  buildDailyRollups,
  buildFifteenMinuteRollups,
  compareRollupTotals,
  evaluateRetentionDryRun,
  finalizedRollupCutoff,
  type FifteenMinuteRollup,
} from "@/lib/telemetry/rollup";

const reading = (
  observedAt: string,
  overrides: Partial<{
    pvPowerW: number;
    loadPowerW: number;
    gridPowerW: number;
    batteryPowerW: number;
    irradianceWm2: number;
    quality: "SIMULATED" | "MEASURED" | "ESTIMATED" | "STALE" | "MISSING";
  }> = {},
) => ({
  observedAt: new Date(observedAt),
  pvPowerW: 1_000,
  loadPowerW: 800,
  gridPowerW: -200,
  batteryPowerW: 0,
  irradianceWm2: 500,
  quality: "SIMULATED" as const,
  ...overrides,
});

describe("15-minute telemetry roll-ups", () => {
  it("integrates evidenced sample duration and records completeness", () => {
    const result = buildFifteenMinuteRollups([
      reading("2026-08-01T00:00:00.000Z"),
      reading("2026-08-01T00:00:30.000Z"),
      reading("2026-08-01T00:01:00.000Z"),
    ], 30);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      bucketStart: new Date("2026-08-01T00:00:00.000Z"),
      bucketEnd: new Date("2026-08-01T00:15:00.000Z"),
      generationWh: 25,
      consumptionWh: 20,
      exportWh: 5,
      importWh: 0,
      sampleCount: 3,
      expectedSampleCount: 30,
      coveredDurationSec: 90,
      coveragePct: 10,
      evidenceQuality: "SIMULATED",
    });
  });

  it("does not bridge a long gateway outage with invented energy", () => {
    const result = buildFifteenMinuteRollups([
      reading("2026-08-01T00:00:00.000Z", { pvPowerW: 3_600 }),
      reading("2026-08-01T00:10:00.000Z", { pvPowerW: 3_600 }),
    ], 30);

    expect(result[0]).toMatchObject({
      generationWh: 60,
      coveredDurationSec: 60,
      maxGapSec: 600,
      coveragePct: 6.67,
    });
  });

  it("splits an evidenced interval at a 15-minute boundary", () => {
    const result = buildFifteenMinuteRollups([
      reading("2026-08-01T00:14:50.000Z", { pvPowerW: 3_600 }),
      reading("2026-08-01T00:15:20.000Z", { pvPowerW: 3_600 }),
    ], 30);

    expect(result.map((bucket) => ({
      at: bucket.bucketStart.toISOString(),
      generationWh: bucket.generationWh,
      coveredDurationSec: bucket.coveredDurationSec,
    }))).toEqual([
      { at: "2026-08-01T00:00:00.000Z", generationWh: 10, coveredDurationSec: 10 },
      { at: "2026-08-01T00:15:00.000Z", generationWh: 50, coveredDurationSec: 50 },
    ]);
  });

  it("withholds stale and missing samples instead of treating them as measured energy", () => {
    const result = buildFifteenMinuteRollups([
      reading("2026-08-01T00:00:00.000Z", { quality: "STALE" }),
      reading("2026-08-01T00:00:30.000Z", { quality: "MISSING" }),
    ], 30);

    expect(result).toEqual([]);
  });
});

describe("site-local daily telemetry roll-ups", () => {
  const interval = (overrides: Partial<FifteenMinuteRollup> = {}): FifteenMinuteRollup => ({
    bucketStart: new Date("2026-08-01T18:30:00.000Z"),
    bucketEnd: new Date("2026-08-01T18:45:00.000Z"),
    generationWh: 100,
    consumptionWh: 120,
    importWh: 30,
    exportWh: 10,
    batteryChargeWh: 5,
    batteryDischargeWh: 2,
    averagePvPowerW: 400,
    peakPvPowerW: 500,
    averageLoadPowerW: 480,
    peakLoadPowerW: 600,
    averageIrradianceWm2: 450,
    sampleCount: 30,
    expectedSampleCount: 30,
    expectedIntervalSec: 30,
    coveredDurationSec: 900,
    coveragePct: 100,
    maxGapSec: 30,
    evidenceQuality: "SIMULATED",
    firstObservedAt: new Date("2026-08-01T18:30:00.000Z"),
    lastObservedAt: new Date("2026-08-01T18:44:30.000Z"),
    ...overrides,
  });

  it("uses the configured timezone and preserves mixed evidence", () => {
    const result = buildDailyRollups([
      interval(),
      interval({
        bucketStart: new Date("2026-08-01T18:45:00.000Z"),
        bucketEnd: new Date("2026-08-01T19:00:00.000Z"),
        generationWh: 150,
        evidenceQuality: "MEASURED",
      }),
    ], "Asia/Colombo");

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      localDate: "2026-08-02",
      dayStartAt: new Date("2026-08-01T18:30:00.000Z"),
      dayEndAt: new Date("2026-08-02T18:30:00.000Z"),
      generationWh: 250,
      intervalCount: 2,
      completeIntervalCount: 2,
      sampleCount: 60,
      expectedSampleCount: 2_880,
      coveragePct: 2.08,
      evidenceQuality: "MIXED",
    });
  });
});

describe("roll-up reconciliation and retention dry-run", () => {
  it("reconciles only intervals that have fully closed", () => {
    expect(finalizedRollupCutoff(new Date("2026-08-26T09:10:54.017Z")).toISOString()).toBe("2026-08-26T09:00:00.000Z");
  });

  it("reports exact energy and coverage mismatches", () => {
    expect(compareRollupTotals(
      { generationWh: 1_000, consumptionWh: 800, importWh: 100, exportWh: 300, batteryChargeWh: 50, batteryDischargeWh: 40, coveredDurationSec: 900 },
      { generationWh: 999, consumptionWh: 800, importWh: 100, exportWh: 300, batteryChargeWh: 50, batteryDischargeWh: 40, coveredDurationSec: 870 },
    )).toEqual({
      passed: false,
      differences: [
        "generationWh expected 1000 but found 999 (difference -1).",
        "coveredDurationSec expected 900 but found 870 (difference -30).",
      ],
    });
  });

  it("keeps retention blocked when reconciliation or bucket coverage is incomplete", () => {
    expect(evaluateRetentionDryRun({
      policyReady: true,
      reconciliationPassed: false,
      eligibleRawRows: 12_000,
      rawRowsMissingRollup: 4,
    })).toEqual({
      allowed: false,
      wouldDeleteRows: 12_000,
      reasons: [
        "The latest telemetry roll-up reconciliation did not pass.",
        "4 eligible raw telemetry rows do not have a corresponding 15-minute roll-up.",
      ],
    });
  });

  it("is still a non-destructive preview when every gate passes", () => {
    expect(evaluateRetentionDryRun({
      policyReady: true,
      reconciliationPassed: true,
      eligibleRawRows: 2_500,
      rawRowsMissingRollup: 0,
    })).toEqual({ allowed: true, wouldDeleteRows: 2_500, reasons: [] });
  });
});
