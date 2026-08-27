import { describe, expect, it } from "vitest";

import { createDashboardSnapshot, createDashboardSnapshotFromTelemetry, summarizeDashboardForecast } from "@/lib/dashboard/snapshot";
import { createTelemetrySnapshot } from "@/lib/telemetry/simulator";

const site = {
  id: "site-demo",
  name: "Colombo Home",
  mode: "SIMULATED" as const,
  status: "ACTIVE" as const,
  timezone: "Asia/Colombo",
};

describe("dashboard simulation snapshot", () => {
  it("is deterministic for the same site and observation time", () => {
    const observedAt = new Date("2026-08-07T06:30:00.000Z");

    expect(createDashboardSnapshot(site, observedAt)).toEqual(
      createDashboardSnapshot(site, observedAt),
    );
  });

  it("maintains the documented energy balance and safe battery bounds", () => {
    const snapshot = createDashboardSnapshot(site, new Date("2026-08-07T06:30:00.000Z"));
    const { batteryPowerKw, gridPowerKw, loadPowerKw, pvPowerKw, batterySocPct } = snapshot.metrics;

    expect(pvPowerKw + batteryPowerKw + gridPowerKw).toBeCloseTo(loadPowerKw, 2);
    expect(batterySocPct).toBeGreaterThanOrEqual(10);
    expect(batterySocPct).toBeLessThanOrEqual(100);
  });

  it("provides an intraday trend and exactly two forecast summary days", () => {
    const snapshot = createDashboardSnapshot(site, new Date("2026-08-07T06:30:00.000Z"));

    expect(snapshot.intraday).toHaveLength(13);
    expect(snapshot.forecast).toHaveLength(2);
    expect(snapshot.forecast.every((day) => day.predictedEnergyKwh > 0)).toBe(true);
  });

  it("maps fresh persisted virtual telemetry without fabricating a forecast", () => {
    const telemetry = createTelemetrySnapshot(site, new Date("2026-08-07T06:30:00.000Z"));
    telemetry.connectivity.gateway = { id: "gateway-1", name: "Virtual plant", status: "ONLINE", lastSeenAt: telemetry.observedAt, expectedIntervalSec: 30 };
    telemetry.irradianceWm2 = 700;

    const snapshot = createDashboardSnapshotFromTelemetry(site, telemetry);

    expect(snapshot.sourceLabel).toBe("Virtual gateway telemetry");
    expect(snapshot.connectivityStatus).toBe("ONLINE");
    expect(snapshot.metrics.weather.condition).toBe("Strong sunlight");
    expect(snapshot.forecast).toEqual([]);
    expect(snapshot.alert.severity).toBe("INFO");
    expect(snapshot.intraday.every((point) => new Date(point.observedAt) <= new Date(snapshot.observedAt))).toBe(true);
  });

  it("labels stale hardware and low irradiance as last-known operational data", () => {
    const telemetry = createTelemetrySnapshot({ ...site, mode: "HARDWARE" }, new Date("2026-08-07T18:30:00.000Z"));
    telemetry.connectivity.gateway = { id: "gateway-2", name: "Hardware plant", status: "STALE", lastSeenAt: telemetry.observedAt, expectedIntervalSec: 30 };
    telemetry.irradianceWm2 = 50;

    const snapshot = createDashboardSnapshotFromTelemetry({ ...site, mode: "HARDWARE" }, telemetry);

    expect(snapshot.sourceLabel).toBe("Hardware gateway telemetry");
    expect(snapshot.metrics.weather.condition).toBe("Low irradiance");
    expect(snapshot.alert).toMatchObject({ severity: "WARNING", title: "Gateway is stale" });
  });

  it("prefers fresh persisted Open-Meteo context and exposes its provenance", () => {
    const now = new Date("2026-08-07T06:45:00.000Z");
    const telemetry = createTelemetrySnapshot(site, new Date("2026-08-07T06:30:00.000Z"));
    const snapshot = createDashboardSnapshotFromTelemetry(site, telemetry, {
      condition: "Partly cloudy",
      temperatureAirC: 29.4,
      shortwaveRadiationWm2: 648,
      globalTiltedIrradianceWm2: null,
      observedAt: "2026-08-07T06:30:00.000Z",
      fetchedAt: "2026-08-07T06:35:00.000Z",
      providerLabel: "Open-Meteo",
      cloudCoverPct: 42,
      precipitationMm: 0,
      relativeHumidityPct: 74,
      windSpeedKmh: 13.2,
    }, now);

    expect(snapshot.metrics.weather).toMatchObject({
      condition: "Partly cloudy",
      temperatureC: 29.4,
      temperatureLabel: "Air temperature",
      irradianceWm2: 648,
      irradianceLabel: "Global irradiance",
      source: "OPEN_METEO",
      sourceLabel: "Open-Meteo",
      freshness: "FRESH",
      cloudCoverPct: 42,
      relativeHumidityPct: 74,
      windSpeedKmh: 13.2,
    });
  });

  it("marks old provider observations stale without hiding their source", () => {
    const telemetry = createTelemetrySnapshot(site, new Date("2026-08-07T06:30:00.000Z"));
    const snapshot = createDashboardSnapshotFromTelemetry(site, telemetry, {
      condition: "Overcast",
      temperatureAirC: 27,
      observedAt: "2026-08-07T02:00:00.000Z",
      fetchedAt: "2026-08-07T02:05:00.000Z",
      providerLabel: "Open-Meteo",
    }, new Date("2026-08-07T06:45:00.000Z"));

    expect(snapshot.metrics.weather).toMatchObject({
      freshness: "STALE",
      source: "OPEN_METEO",
      sourceLabel: "Open-Meteo",
    });
  });

  it("summarizes only the first 48 lead hours without inventing confidence", () => {
    expect(summarizeDashboardForecast([
      { validAt: "2026-08-21T05:00:00.000Z", leadHours: 1, estimatedEnergyKwh: 1.2 },
      { validAt: "2026-08-21T06:00:00.000Z", leadHours: 2, estimatedEnergyKwh: 1.8 },
      { validAt: "2026-08-22T05:00:00.000Z", leadHours: 25, estimatedEnergyKwh: 2.5 },
      { validAt: "2026-08-23T05:00:00.000Z", leadHours: 49, estimatedEnergyKwh: 99 },
    ], "Asia/Colombo", new Date("2026-08-21T04:30:00.000Z"))).toEqual([
      { label: "Fri, Aug 21", predictedEnergyKwh: 3 },
      { label: "Sat, Aug 22", predictedEnergyKwh: 2.5 },
    ]);
  });

  it("rolls the 48-hour window from now instead of stale model lead numbers", () => {
    expect(summarizeDashboardForecast([
      { validAt: "2026-08-25T09:00:00.000Z", leadHours: 1, estimatedEnergyKwh: 99 },
      { validAt: "2026-08-25T11:00:00.000Z", leadHours: 120, estimatedEnergyKwh: 1.5 },
      { validAt: "2026-08-27T10:01:00.000Z", leadHours: 168, estimatedEnergyKwh: 99 },
    ], "Asia/Colombo", new Date("2026-08-25T10:00:00.000Z"))).toEqual([
      { label: "Tue, Aug 25", predictedEnergyKwh: 1.5 },
    ]);
  });

  it("builds a short hourly and seven-day weather outlook from stored provider points", () => {
    const telemetry = createTelemetrySnapshot(site, new Date("2026-08-25T06:30:00.000Z"));
    const snapshot = createDashboardSnapshotFromTelemetry(site, telemetry, {
      condition: "Partly cloudy",
      temperatureAirC: 29,
      observedAt: "2026-08-25T06:30:00.000Z",
      fetchedAt: "2026-08-25T06:35:00.000Z",
      providerLabel: "Open-Meteo",
      forecastPoints: [
        { validAt: "2026-08-25T07:00:00.000Z", condition: "Cloudy", temperatureC: 30, precipitationProbabilityPct: 20, windSpeedKmh: 12, irradianceWm2: 600 },
        { validAt: "2026-08-26T07:00:00.000Z", condition: "Rain", temperatureC: 27, precipitationProbabilityPct: 80, windSpeedKmh: 18, irradianceWm2: 250 },
      ],
    }, new Date("2026-08-25T06:45:00.000Z"));

    expect(snapshot.metrics.weather.hourly).toHaveLength(2);
    expect(snapshot.metrics.weather.daily).toEqual([
      expect.objectContaining({ label: "Tue", temperatureMinC: 30, temperatureMaxC: 30 }),
      expect.objectContaining({ label: "Wed", condition: "Rain", precipitationProbabilityPct: 80 }),
    ]);
  });
});
