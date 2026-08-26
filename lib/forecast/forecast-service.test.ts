import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findSite: vi.fn(),
  findSites: vi.fn(),
  findLatestRun: vi.fn(),
  createRun: vi.fn(),
  transaction: vi.fn(),
  requestForecast: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({
  db: {
    solarSite: { findFirst: mocks.findSite, findMany: mocks.findSites },
    solarForecastRun: { findFirst: mocks.findLatestRun },
    $transaction: mocks.transaction,
  },
}));
vi.mock("@/lib/forecast/ml-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/forecast/ml-client")>()),
  requestSolarForecast: mocks.requestForecast,
}));

import {
  ForecastDomainError,
  generateSiteForecast,
  getLatestSiteForecast,
  refreshAllStaleSiteForecasts,
} from "@/lib/forecast/forecast-service";

const actor = { id: "user-1", role: "USER" as const };
const now = new Date("2026-08-21T04:30:00.000Z");
const weatherPoint = {
  validAt: new Date("2026-08-21T05:00:00.000Z"),
  temperatureAirC: 29,
  relativeHumidityPct: 70,
  cloudCoverPct: 25,
  precipitationMm: 0,
  windSpeedKmh: 14,
  shortwaveRadiationWm2: 600,
};
const mlResult = {
  requestId: "request-1",
  siteId: "site-1",
  issuedAt: "2026-08-21T04:00:00.000Z",
  model: {
    name: "Aelora UNISOLAR capacity challenger v3",
    family: "random_forest",
    status: "CHALLENGER_NOT_ACTIVE",
    artifactSha256: "b".repeat(64),
    productionActivationAllowed: false,
    featureSchemaVersion: "1.0.0",
  },
  points: [{
    validAt: "2026-08-21T05:00:00.000Z",
    leadHours: 1,
    capacityFactor: 0.42,
    estimatedPowerKw: 1.89,
    estimatedEnergyKwh: 1.89,
    source: "MODEL" as const,
  }],
  totals: { estimatedEnergyKwh: 1.89, daylightHours: 1 },
  limitations: ["Challenger model: production activation is not approved."],
};

describe("forecast service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findSite.mockResolvedValue({
      id: "site-1",
      name: "Colombo Home",
      timezone: "Asia/Colombo",
      arrays: [
        { panelCount: 4, ratedPowerW: 450 },
        { panelCount: 6, ratedPowerW: 450 },
      ],
      weatherForecastRuns: [{
        id: "weather-run-1",
        fetchedAt: new Date("2026-08-21T04:00:00.000Z"),
        provider: "OPEN_METEO",
        attribution: "Weather data by Open-Meteo.com",
        points: [weatherPoint],
      }],
      telemetry: [
        { observedAt: new Date("2026-08-19T05:00:00.000Z"), loadPowerW: 1_000 },
        { observedAt: new Date("2026-08-20T05:00:00.000Z"), loadPowerW: 3_000 },
      ],
    });
    mocks.requestForecast.mockResolvedValue(mlResult);
    mocks.createRun.mockResolvedValue({
      id: "solar-run-1",
      createdAt: new Date("2026-08-21T04:31:00.000Z"),
    });
    mocks.transaction.mockImplementation(async (callback) => callback({
      solarForecastRun: { create: mocks.createRun },
    }));
  });

  it("uses owner-scoped weather and capacity, then stores the run and points atomically", async () => {
    const result = await generateSiteForecast(actor, "site-1", {
      now,
      requestId: "request-1",
    });

    expect(mocks.findSite).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: "site-1", ownerId: "user-1", deletedAt: null }),
    }));
    expect(mocks.requestForecast).toHaveBeenCalledWith(expect.objectContaining({
      requestId: "request-1",
      siteId: "site-1",
      issuedAt: "2026-08-21T04:00:00.000Z",
      installedCapacityKwp: 4.5,
      points: [expect.objectContaining({
        validAt: "2026-08-21T05:00:00.000Z",
        shortwaveRadiationWm2: 600,
      })],
    }));
    expect(mocks.createRun).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        siteId: "site-1",
        weatherForecastRunId: "weather-run-1",
        requestId: "request-1",
        installedCapacityKwp: 4.5,
        productionActivationAllowed: false,
        estimatedLoadEnergyKwh: 2,
        loadForecastMethod: "HISTORICAL_HOURLY_MEDIAN",
        points: { create: [expect.objectContaining({ estimatedEnergyKwh: 1.89, estimatedLoadPowerKw: 2 })] },
      }),
    }));
    expect(result).toMatchObject({ id: "solar-run-1", requestId: "request-1" });
  });

  it("refuses to call the model when there is no complete stored weather horizon", async () => {
    mocks.findSite.mockResolvedValue({
      id: "site-1",
      name: "Colombo Home",
      timezone: "Asia/Colombo",
      arrays: [{ panelCount: 10, ratedPowerW: 450 }],
      weatherForecastRuns: [],
    });

    await expect(generateSiteForecast(actor, "site-1", { now, requestId: "request-1" }))
      .rejects.toMatchObject({ code: "weather_unavailable" });
    expect(mocks.requestForecast).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("treats another user's site as not found", async () => {
    mocks.findSite.mockResolvedValue(null);

    await expect(generateSiteForecast(actor, "site-2", { now, requestId: "request-1" }))
      .rejects.toEqual(new ForecastDomainError("site_not_found"));
  });

  it("returns only an owner-scoped persisted forecast DTO", async () => {
    mocks.findLatestRun.mockResolvedValue({
      id: "solar-run-1",
      requestId: "request-1",
      issuedAt: new Date(mlResult.issuedAt),
      createdAt: new Date("2026-08-21T04:31:00.000Z"),
      installedCapacityKwp: 4.5,
      modelName: mlResult.model.name,
      modelFamily: mlResult.model.family,
      modelStatus: mlResult.model.status,
      artifactSha256: mlResult.model.artifactSha256,
      featureSchemaVersion: mlResult.model.featureSchemaVersion,
      productionActivationAllowed: false,
      estimatedEnergyKwh: 1.89,
      daylightHours: 1,
      estimatedLoadEnergyKwh: 2,
      loadForecastMethod: "HISTORICAL_HOURLY_MEDIAN",
      limitations: mlResult.limitations,
      site: { id: "site-1", name: "Colombo Home", timezone: "Asia/Colombo" },
      weatherForecastRun: {
        id: "weather-run-1",
        provider: "OPEN_METEO",
        fetchedAt: new Date("2026-08-21T04:00:00.000Z"),
        attribution: "Weather data by Open-Meteo.com",
      },
      points: mlResult.points.map((point) => ({
        ...point,
        id: "point-1",
        validAt: new Date(point.validAt),
        estimatedLoadPowerKw: 2,
        estimatedLoadEnergyKwh: 2,
      })),
    });

    await expect(getLatestSiteForecast(actor, "site-1")).resolves.toMatchObject({
      id: "solar-run-1",
      site: { name: "Colombo Home" },
      totals: { estimatedLoadEnergyKwh: 2 },
      loadForecast: { method: "HISTORICAL_HOURLY_MEDIAN" },
      points: [{ validAt: "2026-08-21T05:00:00.000Z", estimatedLoadPowerKw: 2 }],
    });
    expect(mocks.findLatestRun).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        siteId: "site-1",
        site: { deletedAt: null, ownerId: "user-1" },
      },
    }));
  });

  it("reruns only sites whose latest forecast is at least 12 hours old", async () => {
    mocks.findSites.mockResolvedValue([
      { id: "site-stale", ownerId: "user-1", solarForecastRuns: [{ createdAt: new Date("2026-08-20T00:00:00.000Z") }], weatherForecastRuns: [{ fetchedAt: new Date("2026-08-21T04:20:00.000Z") }] },
      { id: "site-fresh", ownerId: "user-2", solarForecastRuns: [{ createdAt: new Date("2026-08-21T00:00:00.000Z") }], weatherForecastRuns: [{ fetchedAt: new Date("2026-08-21T04:20:00.000Z") }] },
      { id: "site-new", ownerId: "user-3", solarForecastRuns: [], weatherForecastRuns: [{ fetchedAt: new Date("2026-08-21T04:20:00.000Z") }] },
    ]);
    const generate = vi.fn().mockResolvedValue({ id: "run" });

    await expect(refreshAllStaleSiteForecasts(now, generate)).resolves.toMatchObject({
      attempted: 3,
      generated: 2,
      skipped: 1,
      failed: 0,
    });
    expect(generate).toHaveBeenCalledTimes(2);
    expect(generate).toHaveBeenCalledWith({ id: "user-1", role: "USER" }, "site-stale", { now });
    expect(generate).toHaveBeenCalledWith({ id: "user-3", role: "USER" }, "site-new", { now });
  });
});
