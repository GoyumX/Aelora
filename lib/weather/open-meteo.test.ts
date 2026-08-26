import { describe, expect, it, vi } from "vitest";

import {
  buildOpenMeteoForecastUrl,
  fetchOpenMeteoForecast,
  summarizeOpenMeteoForecast,
} from "@/lib/weather/open-meteo";

export const openMeteoFixture = {
  latitude: 6.875,
  longitude: 79.875,
  timezone: "GMT",
  utc_offset_seconds: 0,
  elevation: 10,
  generationtime_ms: 0.42,
  current: {
    time: "2026-08-18T06:30",
    interval: 900,
    temperature_2m: 29.4,
    apparent_temperature: 34.1,
    relative_humidity_2m: 76,
    cloud_cover: 42,
    precipitation: 0,
    wind_speed_10m: 12.6,
    wind_direction_10m: 230,
    weather_code: 2,
    shortwave_radiation: 648,
    direct_radiation: 405,
    diffuse_radiation: 243,
    direct_normal_irradiance: 566,
    is_day: 1,
  },
  hourly: {
    time: ["2026-08-18T06:00", "2026-08-18T07:00"],
    temperature_2m: [28.9, 29.8],
    relative_humidity_2m: [78, 74],
    cloud_cover: [48, 36],
    precipitation_probability: [10, 30],
    precipitation: [0, 0.1],
    wind_speed_10m: [11.2, 13.1],
    weather_code: [2, 3],
    shortwave_radiation: [590, 702],
    direct_radiation: [355, 460],
    diffuse_radiation: [235, 242],
    direct_normal_irradiance: [515, 641],
  },
};

describe("Open-Meteo forecast contract", () => {
  it("builds a canonical UTC, seven-day request with current and hourly solar features", () => {
    const url = buildOpenMeteoForecastUrl({ latitude: 6.9271, longitude: 79.8612, forecastDays: 7 });

    expect(url.origin).toBe("https://api.open-meteo.com");
    expect(url.pathname).toBe("/v1/forecast");
    expect(url.searchParams.get("timezone")).toBe("UTC");
    expect(url.searchParams.get("forecast_days")).toBe("7");
    expect(url.searchParams.get("models")).toBe("best_match");
    expect(url.searchParams.get("current")).toContain("temperature_2m");
    expect(url.searchParams.get("current")).toContain("shortwave_radiation");
    expect(url.searchParams.get("hourly")).toContain("direct_normal_irradiance");
  });

  it("fetches and normalizes current plus hourly values without local-time ambiguity", async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => openMeteoFixture });

    const payload = await fetchOpenMeteoForecast({ latitude: 6.9271, longitude: 79.8612, fetcher });
    const parsed = summarizeOpenMeteoForecast(payload, new Date("2026-08-18T06:35:00.000Z"));

    expect(fetcher).toHaveBeenCalledWith(expect.any(URL), expect.objectContaining({ cache: "no-store" }));
    expect(parsed.provider).toBe("OPEN_METEO");
    expect(parsed.modelSelection).toBe("best_match");
    expect(parsed.current).toMatchObject({
      observedAt: new Date("2026-08-18T06:30:00.000Z"),
      fetchedAt: new Date("2026-08-18T06:35:00.000Z"),
      condition: "Partly cloudy",
      temperatureC: 29.4,
      relativeHumidityPct: 76,
      shortwaveRadiationWm2: 648,
    });
    expect(parsed.hourly[1]).toMatchObject({
      validAt: new Date("2026-08-18T07:00:00.000Z"),
      condition: "Overcast",
      precipitationProbabilityPct: 30,
      directNormalIrradianceWm2: 641,
    });
  });

  it("rejects misaligned hourly arrays instead of shifting weather onto the wrong timestamp", () => {
    const invalid = structuredClone(openMeteoFixture);
    invalid.hourly.cloud_cover.pop();

    expect(() => summarizeOpenMeteoForecast(invalid, new Date())).toThrow(/hourly arrays/i);
  });

  it("surfaces a provider failure without leaking its response body", async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: false, status: 503, json: async () => ({ detail: "internal provider trace" }) });

    await expect(fetchOpenMeteoForecast({ latitude: 6.9271, longitude: 79.8612, fetcher })).rejects.toThrow("Weather provider returned HTTP 503");
  });
});
