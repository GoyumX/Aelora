import { describe, expect, it } from "vitest";

import {
  FORECAST_REFRESH_INTERVAL_MS,
  WEATHER_REFRESH_INTERVAL_MS,
  isForecastRefreshDue,
  isWeatherRefreshDue,
} from "@/lib/refresh/freshness";

const now = new Date("2026-08-25T12:00:00.000Z");

describe("dynamic data freshness policy", () => {
  it("refreshes weather at 30 minutes", () => {
    expect(WEATHER_REFRESH_INTERVAL_MS).toBe(30 * 60 * 1000);
    expect(isWeatherRefreshDue("2026-08-25T11:31:00.000Z", now)).toBe(false);
    expect(isWeatherRefreshDue("2026-08-25T11:30:00.000Z", now)).toBe(true);
    expect(isWeatherRefreshDue(null, now)).toBe(true);
  });

  it("reruns the seven-day model at 12 hours", () => {
    expect(FORECAST_REFRESH_INTERVAL_MS).toBe(12 * 60 * 60 * 1000);
    expect(isForecastRefreshDue("2026-08-25T00:01:00.000Z", now)).toBe(false);
    expect(isForecastRefreshDue("2026-08-25T00:00:00.000Z", now)).toBe(true);
    expect(isForecastRefreshDue(null, now)).toBe(true);
  });
});
