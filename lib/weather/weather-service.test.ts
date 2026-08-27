import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findSite: vi.fn(),
  findSites: vi.fn(),
  upsertObservation: vi.fn(),
  upsertRun: vi.fn(),
  findObservation: vi.fn(),
  findRun: vi.fn(),
  transaction: vi.fn(),
  fetchForecast: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({
  db: {
    solarSite: { findFirst: mocks.findSite, findMany: mocks.findSites },
    weatherObservation: { findFirst: mocks.findObservation },
    weatherForecastRun: { findFirst: mocks.findRun },
    $transaction: mocks.transaction,
  },
}));
vi.mock("@/lib/weather/open-meteo", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/weather/open-meteo")>()),
  fetchOpenMeteoForecast: mocks.fetchForecast,
}));

import {
  getLatestSiteWeather,
  syncAllActiveSiteWeather,
  syncSiteWeather,
  toOpenMeteoAzimuth,
} from "@/lib/weather/weather-service";

const openMeteoPayload = {
  latitude: 6.9,
  longitude: 79.86,
  generationtime_ms: 1.23,
  utc_offset_seconds: 0,
  timezone: "GMT",
  timezone_abbreviation: "GMT",
  current: {
    time: "2026-08-18T08:00",
    interval: 900,
    temperature_2m: 30.4,
    relative_humidity_2m: 72,
    apparent_temperature: 34.1,
    precipitation: 0,
    weather_code: 2,
    cloud_cover: 35,
    wind_speed_10m: 12.5,
    wind_direction_10m: 230,
    shortwave_radiation: 735,
    direct_radiation: 540,
    diffuse_radiation: 180,
    direct_normal_irradiance: 710,
    global_tilted_irradiance: 812,
    is_day: 1,
  },
  hourly: {
    time: ["2026-08-18T08:00", "2026-08-18T09:00"],
    temperature_2m: [30.8, 30.2],
    relative_humidity_2m: [70, 73],
    cloud_cover: [32, 45],
    precipitation_probability: [10, 30],
    precipitation: [0, 0.4],
    wind_speed_10m: [12, 14],
    weather_code: [2, 3],
    shortwave_radiation: [780, 640],
    direct_radiation: [560, 390],
    diffuse_radiation: [190, 230],
    direct_normal_irradiance: [720, 610],
    global_tilted_irradiance: [840, 690],
  },
};

describe("weather service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findSite.mockResolvedValue({
      id: "site-1",
      latitude: 6.9271,
      longitude: 79.8612,
      arrays: [
        { panelCount: 4, ratedPowerW: 450, tiltDeg: 10, azimuthDeg: 170 },
        { panelCount: 6, ratedPowerW: 450, tiltDeg: 20, azimuthDeg: 190 },
      ],
    });
    mocks.fetchForecast.mockResolvedValue(openMeteoPayload);
    mocks.upsertObservation.mockResolvedValue({ id: "weather-observation-1" });
    mocks.upsertRun.mockResolvedValue({ id: "weather-run-1" });
    mocks.transaction.mockImplementation(async (callback) => callback({
      weatherObservation: { upsert: mocks.upsertObservation },
      weatherForecastRun: { upsert: mocks.upsertRun },
    }));
  });

  it("converts the app azimuth convention to Open-Meteo", () => {
    expect(toOpenMeteoAzimuth(0)).toBe(-180);
    expect(toOpenMeteoAzimuth(90)).toBe(-90);
    expect(toOpenMeteoAzimuth(180)).toBe(0);
    expect(toOpenMeteoAzimuth(270)).toBe(90);
  });

  it("stores current and hourly UTC weather atomically using weighted array orientation", async () => {
    const fetchedAt = new Date("2026-08-18T08:05:00.000Z");
    await expect(syncSiteWeather("site-1", fetchedAt)).resolves.toMatchObject({
      synced: true,
      pointCount: 2,
      currentCondition: "Partly cloudy",
      observedAt: "2026-08-18T08:00:00.000Z",
    });

    expect(mocks.fetchForecast).toHaveBeenCalledWith(expect.objectContaining({
      latitude: 6.9271,
      longitude: 79.8612,
      forecastDays: 7,
      tiltDeg: 16,
      azimuthDeg: 2,
    }));
    expect(mocks.upsertObservation).toHaveBeenCalledWith(expect.objectContaining({
      where: { siteId_provider_observedAt: { siteId: "site-1", provider: "OPEN_METEO", observedAt: new Date("2026-08-18T08:00:00.000Z") } },
      create: expect.objectContaining({
        fetchedAt,
        condition: "Partly cloudy",
        globalTiltedIrradianceWm2: 812,
      }),
    }));
    expect(mocks.upsertRun).toHaveBeenCalledWith(expect.objectContaining({
      where: { siteId_provider_fetchedAt: { siteId: "site-1", provider: "OPEN_METEO", fetchedAt } },
      create: expect.objectContaining({
        requestTimezone: "UTC",
        modelSelection: "best_match",
        points: {
          create: [
            expect.objectContaining({ validAt: new Date("2026-08-18T08:00:00.000Z"), relativeHumidityPct: 70, globalTiltedIrradianceWm2: 840 }),
            expect.objectContaining({ validAt: new Date("2026-08-18T09:00:00.000Z"), precipitationProbabilityPct: 30, windSpeedKmh: 14 }),
          ],
        },
      }),
    }));
  });

  it("returns null for a missing or inactive site without calling the provider", async () => {
    mocks.findSite.mockResolvedValue(null);

    await expect(syncSiteWeather("missing-site")).resolves.toBeNull();
    expect(mocks.fetchForecast).not.toHaveBeenCalled();
  });

  it("loads the latest bounded observation and forecast projection", async () => {
    mocks.findObservation.mockResolvedValue({ condition: "Overcast" });
    mocks.findRun.mockResolvedValue({ points: [{ condition: "Rain" }] });

    await expect(getLatestSiteWeather("site-1")).resolves.toEqual({
      observation: { condition: "Overcast" },
      forecastRun: { points: [{ condition: "Rain" }] },
    });
    expect(mocks.findObservation).toHaveBeenCalledWith(expect.objectContaining({ where: { siteId: "site-1", provider: "OPEN_METEO" } }));
    expect(mocks.findRun).toHaveBeenCalledWith(expect.objectContaining({ where: { siteId: "site-1", provider: "OPEN_METEO" } }));
  });

  it("continues a scheduled batch when one site fails", async () => {
    mocks.findSites.mockResolvedValue([
      { id: "site-1", weatherForecastRuns: [] },
      { id: "site-2", weatherForecastRuns: [] },
    ]);
    mocks.findSite
      .mockResolvedValueOnce({ id: "site-1", latitude: 6.9, longitude: 79.8, arrays: [] })
      .mockResolvedValueOnce({ id: "site-2", latitude: 7, longitude: 80, arrays: [] });
    mocks.fetchForecast
      .mockResolvedValueOnce(openMeteoPayload)
      .mockRejectedValueOnce(new Error("provider unavailable"));

    await expect(syncAllActiveSiteWeather(new Date("2026-08-18T08:05:00.000Z"))).resolves.toMatchObject({
      attempted: 2,
      synced: 1,
      failed: 1,
    });
  });

  it("skips a site refreshed within the minimum scheduler interval", async () => {
    mocks.findSites.mockResolvedValue([{
      id: "site-1",
      weatherForecastRuns: [{ fetchedAt: new Date("2026-08-18T08:00:00.000Z") }],
    }]);

    await expect(syncAllActiveSiteWeather(new Date("2026-08-18T08:10:00.000Z"))).resolves.toMatchObject({
      attempted: 1,
      synced: 0,
      skipped: 1,
      failed: 0,
    });
    expect(mocks.findSite).not.toHaveBeenCalled();
    expect(mocks.fetchForecast).not.toHaveBeenCalled();
  });
});
