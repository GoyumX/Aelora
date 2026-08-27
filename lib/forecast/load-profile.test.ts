import { describe, expect, it } from "vitest";

import { buildHouseholdLoadForecast } from "@/lib/forecast/load-profile";

describe("household load forecast", () => {
  it("uses the median load for the same local hour across stored telemetry", () => {
    const forecast = buildHouseholdLoadForecast(
      [
        { observedAt: new Date("2026-08-19T05:30:00.000Z"), loadPowerW: 1_000 },
        { observedAt: new Date("2026-08-20T05:30:00.000Z"), loadPowerW: 3_000 },
        { observedAt: new Date("2026-08-20T06:30:00.000Z"), loadPowerW: 4_000 },
      ],
      [new Date("2026-08-21T05:30:00.000Z"), new Date("2026-08-21T06:30:00.000Z")],
      "Asia/Colombo",
    );

    expect(forecast).toMatchObject({
      method: "HISTORICAL_HOURLY_MEDIAN",
      estimatedLoadEnergyKwh: 6,
      points: [
        { estimatedLoadPowerKw: 2, estimatedLoadEnergyKwh: 2 },
        { estimatedLoadPowerKw: 4, estimatedLoadEnergyKwh: 4 },
      ],
    });
  });

  it("does not fabricate household usage when no telemetry history exists", () => {
    const forecast = buildHouseholdLoadForecast(
      [],
      [new Date("2026-08-21T05:30:00.000Z")],
      "Asia/Colombo",
    );

    expect(forecast).toEqual({
      method: "NO_HISTORY",
      estimatedLoadEnergyKwh: null,
      points: [{ estimatedLoadPowerKw: null, estimatedLoadEnergyKwh: null }],
    });
  });
});
