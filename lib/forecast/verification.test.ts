import { describe, expect, it } from "vitest";

import {
  evaluateForecastSamples,
  integrateGenerationInterval,
  type ForecastVerificationSample,
} from "@/lib/forecast/verification";

function sample(overrides: Partial<ForecastVerificationSample> = {}): ForecastVerificationSample {
  return {
    forecastPointId: "point-1",
    artifactSha256: "a".repeat(64),
    forecastIssuedAt: "2026-08-20T00:00:00.000Z",
    validAt: "2026-08-21T05:00:00.000Z",
    leadHours: 24,
    estimatedEnergyKwh: 2,
    actualEnergyKwh: 1,
    actualQuality: "SIMULATED",
    ...overrides,
  };
}

describe("forecast verification math", () => {
  it("creates an hourly actual label only from a sufficiently complete interval", () => {
    const start = new Date("2026-08-21T05:00:00.000Z");
    const end = new Date("2026-08-21T06:00:00.000Z");
    const result = integrateGenerationInterval([
      { observedAt: new Date("2026-08-21T05:00:00.000Z"), pvPowerW: 1_000, quality: "SIMULATED" },
      { observedAt: new Date("2026-08-21T05:15:00.000Z"), pvPowerW: 2_000, quality: "SIMULATED" },
      { observedAt: new Date("2026-08-21T05:30:00.000Z"), pvPowerW: 3_000, quality: "SIMULATED" },
      { observedAt: new Date("2026-08-21T05:45:00.000Z"), pvPowerW: 4_000, quality: "SIMULATED" },
    ], start, end, 900);

    expect(result).toEqual({
      eligible: true,
      actualEnergyKwh: 2.5,
      coveragePct: 100,
      sampleCount: 4,
      sampleIntervalSec: 900,
      actualQuality: "SIMULATED",
    });
  });

  it("withholds incomplete and stale labels instead of extrapolating them", () => {
    const result = integrateGenerationInterval([
      { observedAt: new Date("2026-08-21T05:00:00.000Z"), pvPowerW: 1_000, quality: "MEASURED" },
      { observedAt: new Date("2026-08-21T05:15:00.000Z"), pvPowerW: 1_000, quality: "STALE" },
      { observedAt: new Date("2026-08-21T05:30:00.000Z"), pvPowerW: 1_000, quality: "MEASURED" },
    ], new Date("2026-08-21T05:00:00.000Z"), new Date("2026-08-21T06:00:00.000Z"), 900);

    expect(result).toMatchObject({ eligible: false, actualEnergyKwh: null, coveragePct: 50, sampleCount: 2 });
  });

  it("deduplicates repeated issue snapshots and excludes all-zero night hours", () => {
    const result = evaluateForecastSamples([
      sample(),
      sample({ forecastPointId: "duplicate-refresh" }),
      sample({ forecastPointId: "point-2", validAt: "2026-08-21T06:00:00.000Z", estimatedEnergyKwh: 3, actualEnergyKwh: 3 }),
      sample({ forecastPointId: "night", validAt: "2026-08-21T19:00:00.000Z", estimatedEnergyKwh: 0, actualEnergyKwh: 0 }),
    ], "Asia/Colombo");

    expect(result.overall).toMatchObject({
      sampleCount: 2,
      maeKwh: 0.5,
      rmseKwh: 0.707,
      biasKwh: 0.5,
      wMapePct: 25,
    });
    expect(result.deduplicatedCount).toBe(3);
    expect(result.excludedNightCount).toBe(1);
    expect(result.evidenceQuality).toBe("SIMULATED");
    expect(result.promotion.status).toBe("BLOCKED_SIMULATED_EVIDENCE");
  });

  it("creates a horizon-specific 90% empirical envelope after 24 unique daylight labels", () => {
    const samples = Array.from({ length: 24 }, (_, index) => sample({
      forecastPointId: `point-${index}`,
      forecastIssuedAt: `2026-08-${String(index + 1).padStart(2, "0")}T00:00:00.000Z`,
      validAt: `2026-09-${String(index + 1).padStart(2, "0")}T05:00:00.000Z`,
      estimatedEnergyKwh: 1 + (index + 1) / 100,
      actualEnergyKwh: 1,
    }));

    const result = evaluateForecastSamples(samples, "Asia/Colombo");

    expect(result.calibration.find((slice) => slice.key === "H24")).toEqual({
      key: "H24",
      label: "1–24 hours",
      sampleCount: 24,
      status: "READY",
      halfWidthKwh: 0.23,
      coverageTargetPct: 90,
    });
  });

  it("requires measured multi-horizon evidence and human review before promotion", () => {
    const samples = Array.from({ length: 105 }, (_, index) => {
      const day = String(index % 15 + 1).padStart(2, "0");
      const leadHours = index % 3 === 0 ? 12 : index % 3 === 1 ? 36 : 72;
      return sample({
        forecastPointId: `measured-${index}`,
        forecastIssuedAt: `2026-07-${day}T00:00:00.000Z`,
        validAt: new Date(Date.UTC(2026, 7, index % 15 + 1, 5, Math.floor(index / 15))).toISOString(),
        leadHours,
        estimatedEnergyKwh: 1.05,
        actualEnergyKwh: 1,
        actualQuality: "MEASURED",
      });
    });

    const result = evaluateForecastSamples(samples, "Asia/Colombo");

    expect(result.evidenceQuality).toBe("MEASURED");
    expect(result.promotion).toMatchObject({ status: "REVIEW_REQUIRED", automaticActivationAllowed: false });
  });
});
