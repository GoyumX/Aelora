import { describe, expect, it } from "vitest";

import { isWeatherSyncAuthorized } from "@/lib/weather/sync-auth";

describe("weather sync authorization", () => {
  it("accepts only the exact bearer secret", () => {
    expect(isWeatherSyncAuthorized("Bearer weather-secret", "weather-secret")).toBe(true);
    expect(isWeatherSyncAuthorized("Bearer other-secret", "weather-secret")).toBe(false);
    expect(isWeatherSyncAuthorized("Basic weather-secret", "weather-secret")).toBe(false);
    expect(isWeatherSyncAuthorized(null, "weather-secret")).toBe(false);
    expect(isWeatherSyncAuthorized("Bearer weather-secret", undefined)).toBe(false);
  });
});
