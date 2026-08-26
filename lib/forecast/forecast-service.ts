import "server-only";

import type { Prisma } from "@prisma/client";

import type { UserRole } from "@/lib/auth/authorization";
import { db } from "@/lib/db";
import {
  requestSolarForecast,
  type MlForecastData,
  type MlForecastRequest,
} from "@/lib/forecast/ml-client";
import {
  buildHouseholdLoadForecast,
  type HouseholdLoadForecast,
} from "@/lib/forecast/load-profile";
import { isForecastRefreshDue, isWeatherRefreshDue } from "@/lib/refresh/freshness";

export type ForecastActor = { id: string; role: UserRole };
export type ForecastDomainCode =
  | "site_not_found"
  | "capacity_unavailable"
  | "weather_unavailable"
  | "weather_incomplete"
  | "ml_identity_mismatch";

export class ForecastDomainError extends Error {
  constructor(public readonly code: ForecastDomainCode) {
    super(code);
    this.name = "ForecastDomainError";
  }
}

export type SolarForecastView = {
  id: string;
  requestId: string;
  issuedAt: string;
  createdAt: string;
  installedCapacityKwp: number;
  model: {
    name: string;
    family: string;
    status: string;
    artifactSha256: string;
    featureSchemaVersion: string;
    productionActivationAllowed: boolean;
  };
  totals: { estimatedEnergyKwh: number; estimatedLoadEnergyKwh: number | null; daylightHours: number };
  loadForecast: { method: string };
  limitations: string[];
  site: { id: string; name: string; timezone: string };
  weather: { runId: string; provider: string; fetchedAt: string; attribution: string };
  points: Array<{
    validAt: string;
    leadHours: number;
    capacityFactor: number;
    estimatedPowerKw: number;
    estimatedEnergyKwh: number;
    estimatedLoadPowerKw: number | null;
    estimatedLoadEnergyKwh: number | null;
    source: "MODEL";
  }>;
};

type GenerateOptions = { now?: Date; requestId?: string };

const siteWhere = (actor: ForecastActor, siteId: string) => ({
  id: siteId,
  deletedAt: null,
  status: "ACTIVE" as const,
  ...(actor.role === "ADMIN" ? {} : { ownerId: actor.id }),
});

function toStringArray(value: Prisma.JsonValue): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === "string");
}

function assertCompleteHourlyWeather(
  points: Array<{
    validAt: Date;
    temperatureAirC: number | null;
    relativeHumidityPct: number | null;
    cloudCoverPct: number | null;
    precipitationMm: number | null;
    windSpeedKmh: number | null;
    shortwaveRadiationWm2: number | null;
  }>,
) {
  if (!points.length) throw new ForecastDomainError("weather_unavailable");
  for (const [index, point] of points.entries()) {
    if (
      point.temperatureAirC == null
      || point.relativeHumidityPct == null
      || point.cloudCoverPct == null
      || point.precipitationMm == null
      || point.windSpeedKmh == null
      || point.shortwaveRadiationWm2 == null
    ) {
      throw new ForecastDomainError("weather_incomplete");
    }
    if (index && point.validAt.getTime() - points[index - 1].validAt.getTime() !== 3_600_000) {
      throw new ForecastDomainError("weather_incomplete");
    }
  }
}

function buildMlRequest(
  site: {
    id: string;
    arrays: Array<{ panelCount: number; ratedPowerW: number }>;
    weatherForecastRuns: Array<{
      fetchedAt: Date;
      points: Array<{
        validAt: Date;
        temperatureAirC: number | null;
        relativeHumidityPct: number | null;
        cloudCoverPct: number | null;
        precipitationMm: number | null;
        windSpeedKmh: number | null;
        shortwaveRadiationWm2: number | null;
      }>;
    }>;
  },
  requestId: string,
): MlForecastRequest {
  const installedCapacityKwp = site.arrays.reduce(
    (total, array) => total + array.panelCount * array.ratedPowerW,
    0,
  ) / 1_000;
  if (installedCapacityKwp <= 0) throw new ForecastDomainError("capacity_unavailable");

  const weather = site.weatherForecastRuns[0];
  if (!weather) throw new ForecastDomainError("weather_unavailable");
  assertCompleteHourlyWeather(weather.points);

  return {
    requestId,
    siteId: site.id,
    issuedAt: weather.fetchedAt.toISOString(),
    installedCapacityKwp,
    points: weather.points.map((point) => ({
      validAt: point.validAt.toISOString(),
      shortwaveRadiationWm2: point.shortwaveRadiationWm2!,
      temperatureC: point.temperatureAirC!,
      relativeHumidityPct: point.relativeHumidityPct!,
      windSpeedKmh: point.windSpeedKmh!,
      precipitationMm: point.precipitationMm!,
      cloudCoverPct: point.cloudCoverPct!,
    })),
  };
}

function createView(
  persisted: { id: string; createdAt: Date },
  site: { id: string; name: string; timezone: string },
  weather: { id: string; provider: string; fetchedAt: Date; attribution: string },
  capacityKwp: number,
  forecast: MlForecastData,
  loadForecast: HouseholdLoadForecast,
): SolarForecastView {
  return {
    id: persisted.id,
    requestId: forecast.requestId,
    issuedAt: forecast.issuedAt,
    createdAt: persisted.createdAt.toISOString(),
    installedCapacityKwp: capacityKwp,
    model: forecast.model,
    totals: { ...forecast.totals, estimatedLoadEnergyKwh: loadForecast.estimatedLoadEnergyKwh },
    loadForecast: { method: loadForecast.method },
    limitations: forecast.limitations,
    site: { id: site.id, name: site.name, timezone: site.timezone },
    weather: {
      runId: weather.id,
      provider: weather.provider,
      fetchedAt: weather.fetchedAt.toISOString(),
      attribution: weather.attribution,
    },
    points: forecast.points.map((point, index) => ({
      ...point,
      ...loadForecast.points[index],
    })),
  };
}

export async function generateSiteForecast(
  actor: ForecastActor,
  siteId: string,
  options: GenerateOptions = {},
): Promise<SolarForecastView> {
  const now = options.now ?? new Date();
  const requestId = options.requestId ?? crypto.randomUUID();
  const site = await db.solarSite.findFirst({
    where: siteWhere(actor, siteId),
    select: {
      id: true,
      name: true,
      timezone: true,
      arrays: {
        where: { archivedAt: null, status: "ACTIVE" },
        select: { panelCount: true, ratedPowerW: true },
      },
      weatherForecastRuns: {
        where: { provider: "OPEN_METEO" },
        orderBy: { fetchedAt: "desc" },
        take: 1,
        select: {
          id: true,
          provider: true,
          fetchedAt: true,
          attribution: true,
          points: {
            where: { validAt: { gt: now } },
            orderBy: { validAt: "asc" },
            take: 168,
            select: {
              validAt: true,
              temperatureAirC: true,
              relativeHumidityPct: true,
              cloudCoverPct: true,
              precipitationMm: true,
              windSpeedKmh: true,
              shortwaveRadiationWm2: true,
            },
          },
        },
      },
      telemetry: {
        where: { observedAt: { lte: now } },
        orderBy: { observedAt: "desc" },
        take: 10_000,
        select: { observedAt: true, loadPowerW: true },
      },
    },
  });
  if (!site) throw new ForecastDomainError("site_not_found");

  const mlRequest = buildMlRequest(site, requestId);
  const weather = site.weatherForecastRuns[0];
  const forecast = await requestSolarForecast(mlRequest);
  if (forecast.requestId !== requestId || forecast.siteId !== site.id) {
    throw new ForecastDomainError("ml_identity_mismatch");
  }
  const loadForecast = buildHouseholdLoadForecast(
    site.telemetry,
    forecast.points.map((point) => new Date(point.validAt)),
    site.timezone,
  );

  const persisted = await db.$transaction((tx) => tx.solarForecastRun.create({
    data: {
      siteId: site.id,
      weatherForecastRunId: weather.id,
      requestId,
      issuedAt: new Date(forecast.issuedAt),
      installedCapacityKwp: mlRequest.installedCapacityKwp,
      modelName: forecast.model.name,
      modelFamily: forecast.model.family,
      modelStatus: forecast.model.status,
      artifactSha256: forecast.model.artifactSha256,
      featureSchemaVersion: forecast.model.featureSchemaVersion,
      productionActivationAllowed: forecast.model.productionActivationAllowed,
      estimatedEnergyKwh: forecast.totals.estimatedEnergyKwh,
      estimatedLoadEnergyKwh: loadForecast.estimatedLoadEnergyKwh,
      loadForecastMethod: loadForecast.method,
      daylightHours: forecast.totals.daylightHours,
      limitations: forecast.limitations,
      points: {
        create: forecast.points.map((point, index) => ({
          validAt: new Date(point.validAt),
          leadHours: point.leadHours,
          capacityFactor: point.capacityFactor,
          estimatedPowerKw: point.estimatedPowerKw,
          estimatedEnergyKwh: point.estimatedEnergyKwh,
          estimatedLoadPowerKw: loadForecast.points[index].estimatedLoadPowerKw,
          estimatedLoadEnergyKwh: loadForecast.points[index].estimatedLoadEnergyKwh,
          source: point.source,
        })),
      },
    },
    select: { id: true, createdAt: true },
  }));

  return createView(persisted, site, weather, mlRequest.installedCapacityKwp, forecast, loadForecast);
}

export async function getLatestSiteForecast(
  actor: ForecastActor,
  siteId: string,
): Promise<SolarForecastView | null> {
  const run = await db.solarForecastRun.findFirst({
    where: {
      siteId,
      site: {
        deletedAt: null,
        ...(actor.role === "ADMIN" ? {} : { ownerId: actor.id }),
      },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      requestId: true,
      issuedAt: true,
      createdAt: true,
      installedCapacityKwp: true,
      modelName: true,
      modelFamily: true,
      modelStatus: true,
      artifactSha256: true,
      featureSchemaVersion: true,
      productionActivationAllowed: true,
      estimatedEnergyKwh: true,
      estimatedLoadEnergyKwh: true,
      loadForecastMethod: true,
      daylightHours: true,
      limitations: true,
      site: { select: { id: true, name: true, timezone: true } },
      weatherForecastRun: {
        select: { id: true, provider: true, fetchedAt: true, attribution: true },
      },
      points: {
        orderBy: { validAt: "asc" },
        select: {
          validAt: true,
          leadHours: true,
          capacityFactor: true,
          estimatedPowerKw: true,
          estimatedEnergyKwh: true,
          estimatedLoadPowerKw: true,
          estimatedLoadEnergyKwh: true,
          source: true,
        },
      },
    },
  });
  if (!run) return null;

  return {
    id: run.id,
    requestId: run.requestId,
    issuedAt: run.issuedAt.toISOString(),
    createdAt: run.createdAt.toISOString(),
    installedCapacityKwp: run.installedCapacityKwp,
    model: {
      name: run.modelName,
      family: run.modelFamily,
      status: run.modelStatus,
      artifactSha256: run.artifactSha256,
      featureSchemaVersion: run.featureSchemaVersion,
      productionActivationAllowed: run.productionActivationAllowed,
    },
    totals: {
      estimatedEnergyKwh: run.estimatedEnergyKwh,
      estimatedLoadEnergyKwh: run.estimatedLoadEnergyKwh,
      daylightHours: run.daylightHours,
    },
    loadForecast: { method: run.loadForecastMethod ?? "NO_HISTORY" },
    limitations: toStringArray(run.limitations),
    site: run.site,
    weather: {
      runId: run.weatherForecastRun.id,
      provider: run.weatherForecastRun.provider,
      fetchedAt: run.weatherForecastRun.fetchedAt.toISOString(),
      attribution: run.weatherForecastRun.attribution,
    },
    points: run.points.map((point) => ({
      validAt: point.validAt.toISOString(),
      leadHours: point.leadHours,
      capacityFactor: point.capacityFactor,
      estimatedPowerKw: point.estimatedPowerKw,
      estimatedEnergyKwh: point.estimatedEnergyKwh,
      estimatedLoadPowerKw: point.estimatedLoadPowerKw,
      estimatedLoadEnergyKwh: point.estimatedLoadEnergyKwh,
      source: point.source,
    })),
  };
}

type ForecastGenerator = typeof generateSiteForecast;

export async function refreshAllStaleSiteForecasts(
  now = new Date(),
  generate: ForecastGenerator = generateSiteForecast,
) {
  const sites = await db.solarSite.findMany({
    where: { deletedAt: null, status: "ACTIVE" },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      ownerId: true,
      solarForecastRuns: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { createdAt: true },
      },
      weatherForecastRuns: {
        where: { provider: "OPEN_METEO" },
        orderBy: { fetchedAt: "desc" },
        take: 1,
        select: { fetchedAt: true },
      },
    },
  });
  const results: Array<{ siteId: string; status: "generated" | "skipped" | "failed" }> = [];

  for (const site of sites) {
    if (!isForecastRefreshDue(site.solarForecastRuns[0]?.createdAt, now)) {
      results.push({ siteId: site.id, status: "skipped" });
      continue;
    }
    if (isWeatherRefreshDue(site.weatherForecastRuns[0]?.fetchedAt, now)) {
      results.push({ siteId: site.id, status: "failed" });
      continue;
    }
    try {
      await generate({ id: site.ownerId, role: "USER" }, site.id, { now });
      results.push({ siteId: site.id, status: "generated" });
    } catch {
      results.push({ siteId: site.id, status: "failed" });
    }
  }

  return {
    attempted: results.length,
    generated: results.filter((result) => result.status === "generated").length,
    skipped: results.filter((result) => result.status === "skipped").length,
    failed: results.filter((result) => result.status === "failed").length,
    results,
  };
}
