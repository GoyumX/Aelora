import "server-only";

import { db } from "@/lib/db";
import {
  OPEN_METEO_ATTRIBUTION,
  OPEN_METEO_MODEL_SELECTION,
  fetchOpenMeteoForecast,
  summarizeOpenMeteoForecast,
} from "@/lib/weather/open-meteo";

const provider = "OPEN_METEO" as const;
const forecastDays = 7;

type ArrayOrientation = {
  panelCount: number;
  ratedPowerW: number;
  tiltDeg: number;
  azimuthDeg: number;
};

function capacityW(array: ArrayOrientation) {
  return array.panelCount * array.ratedPowerW;
}

function weightedTilt(arrays: ArrayOrientation[]) {
  const total = arrays.reduce((sum, array) => sum + capacityW(array), 0);
  if (total <= 0) return undefined;
  return Math.round(arrays.reduce(
    (sum, array) => sum + array.tiltDeg * capacityW(array),
    0,
  ) / total);
}

function weightedAzimuthNorthClockwise(arrays: ArrayOrientation[]) {
  const total = arrays.reduce((sum, array) => sum + capacityW(array), 0);
  if (total <= 0) return undefined;
  const east = arrays.reduce(
    (sum, array) => sum + Math.sin((array.azimuthDeg * Math.PI) / 180) * capacityW(array),
    0,
  ) / total;
  const north = arrays.reduce(
    (sum, array) => sum + Math.cos((array.azimuthDeg * Math.PI) / 180) * capacityW(array),
    0,
  ) / total;
  return (Math.atan2(east, north) * 180) / Math.PI;
}

// Aelora: 0° north, clockwise. Open-Meteo: 0° south, -90° east, +90° west.
export function toOpenMeteoAzimuth(appAzimuthDeg: number | undefined) {
  if (appAzimuthDeg == null) return undefined;
  return Math.round((((appAzimuthDeg - 180 + 540) % 360) - 180));
}

export async function syncSiteWeather(siteId: string, fetchedAt = new Date()) {
  const site = await db.solarSite.findFirst({
    where: { id: siteId, deletedAt: null, status: "ACTIVE" },
    select: {
      id: true,
      latitude: true,
      longitude: true,
      arrays: {
        where: { status: "ACTIVE", archivedAt: null },
        select: { panelCount: true, ratedPowerW: true, tiltDeg: true, azimuthDeg: true },
      },
    },
  });
  if (!site) return null;

  const tiltDeg = weightedTilt(site.arrays);
  const azimuthDeg = toOpenMeteoAzimuth(weightedAzimuthNorthClockwise(site.arrays));
  const payload = await fetchOpenMeteoForecast({
    latitude: site.latitude,
    longitude: site.longitude,
    tiltDeg,
    azimuthDeg,
    forecastDays,
  });
  const summary = summarizeOpenMeteoForecast(payload, fetchedAt);

  await db.$transaction(async (tx) => {
    await tx.weatherObservation.upsert({
      where: {
        siteId_provider_observedAt: {
          siteId: site.id,
          provider,
          observedAt: summary.current.observedAt,
        },
      },
      create: {
        siteId: site.id,
        provider,
        observedAt: summary.current.observedAt,
        fetchedAt,
        condition: summary.current.condition,
        temperatureAirC: summary.current.temperatureC,
        apparentTemperatureC: summary.current.apparentTemperatureC,
        relativeHumidityPct: summary.current.relativeHumidityPct,
        cloudCoverPct: summary.current.cloudCoverPct,
        precipitationMm: summary.current.precipitationMm,
        weatherCode: summary.current.weatherCode,
        windSpeedKmh: summary.current.windSpeedKmh,
        windDirectionDeg: summary.current.windDirectionDeg,
        shortwaveRadiationWm2: summary.current.shortwaveRadiationWm2,
        directRadiationWm2: summary.current.directRadiationWm2,
        diffuseRadiationWm2: summary.current.diffuseRadiationWm2,
        directNormalIrradianceWm2: summary.current.directNormalIrradianceWm2,
        globalTiltedIrradianceWm2: summary.current.globalTiltedIrradianceWm2,
        isDay: summary.current.isDay,
        raw: payload.current,
      },
      update: {
        fetchedAt,
        condition: summary.current.condition,
        temperatureAirC: summary.current.temperatureC,
        apparentTemperatureC: summary.current.apparentTemperatureC,
        relativeHumidityPct: summary.current.relativeHumidityPct,
        cloudCoverPct: summary.current.cloudCoverPct,
        precipitationMm: summary.current.precipitationMm,
        weatherCode: summary.current.weatherCode,
        windSpeedKmh: summary.current.windSpeedKmh,
        windDirectionDeg: summary.current.windDirectionDeg,
        shortwaveRadiationWm2: summary.current.shortwaveRadiationWm2,
        directRadiationWm2: summary.current.directRadiationWm2,
        diffuseRadiationWm2: summary.current.diffuseRadiationWm2,
        directNormalIrradianceWm2: summary.current.directNormalIrradianceWm2,
        globalTiltedIrradianceWm2: summary.current.globalTiltedIrradianceWm2,
        isDay: summary.current.isDay,
        raw: payload.current,
      },
    });

    await tx.weatherForecastRun.upsert({
      where: {
        siteId_provider_fetchedAt: { siteId: site.id, provider, fetchedAt },
      },
      update: {},
      create: {
        siteId: site.id,
        provider,
        modelSelection: OPEN_METEO_MODEL_SELECTION,
        fetchedAt,
        forecastDays,
        requestLatitude: site.latitude,
        requestLongitude: site.longitude,
        requestTimezone: "UTC",
        requestTiltDeg: tiltDeg,
        requestAzimuthDeg: azimuthDeg,
        responseTimezone: payload.timezone,
        responseUtcOffsetSeconds: payload.utc_offset_seconds,
        generationTimeMs: payload.generationtime_ms,
        attribution: OPEN_METEO_ATTRIBUTION,
        rawMetadata: {
          latitude: payload.latitude,
          longitude: payload.longitude,
          timezoneAbbreviation: payload.timezone_abbreviation,
        },
        points: {
          create: summary.hourly.map((point) => ({
            validAt: point.validAt,
            condition: point.condition,
            temperatureAirC: point.temperatureC,
            relativeHumidityPct: point.relativeHumidityPct,
            cloudCoverPct: point.cloudCoverPct,
            precipitationProbabilityPct: point.precipitationProbabilityPct,
            precipitationMm: point.precipitationMm,
            windSpeedKmh: point.windSpeedKmh,
            weatherCode: point.weatherCode,
            shortwaveRadiationWm2: point.shortwaveRadiationWm2,
            directRadiationWm2: point.directRadiationWm2,
            diffuseRadiationWm2: point.diffuseRadiationWm2,
            directNormalIrradianceWm2: point.directNormalIrradianceWm2,
            globalTiltedIrradianceWm2: point.globalTiltedIrradianceWm2,
          })),
        },
      },
    });
  });

  return {
    synced: true,
    pointCount: summary.hourly.length,
    currentCondition: summary.current.condition,
    observedAt: summary.current.observedAt.toISOString(),
  };
}

export async function syncAllActiveSiteWeather(now = new Date()) {
  const sites = await db.solarSite.findMany({
    where: { deletedAt: null, status: "ACTIVE" },
    select: {
      id: true,
      weatherForecastRuns: {
        where: { provider },
        orderBy: { fetchedAt: "desc" },
        take: 1,
        select: { fetchedAt: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });
  const results: Array<{ siteId: string; status: "synced" | "skipped" | "failed" }> = [];

  for (const site of sites) {
    const lastFetchedAt = site.weatherForecastRuns[0]?.fetchedAt;
    if (lastFetchedAt && now.getTime() - lastFetchedAt.getTime() < 30 * 60 * 1000) {
      results.push({ siteId: site.id, status: "skipped" });
      continue;
    }
    try {
      const result = await syncSiteWeather(site.id, now);
      results.push({ siteId: site.id, status: result ? "synced" : "failed" });
    } catch {
      results.push({ siteId: site.id, status: "failed" });
    }
  }

  return {
    attempted: results.length,
    synced: results.filter((result) => result.status === "synced").length,
    skipped: results.filter((result) => result.status === "skipped").length,
    failed: results.filter((result) => result.status === "failed").length,
    results,
  };
}

export async function getLatestSiteWeather(siteId: string) {
  const [observation, forecastRun] = await Promise.all([
    db.weatherObservation.findFirst({
      where: { siteId, provider },
      orderBy: { observedAt: "desc" },
      select: {
        condition: true,
        temperatureAirC: true,
        relativeHumidityPct: true,
        cloudCoverPct: true,
        precipitationMm: true,
        windSpeedKmh: true,
        shortwaveRadiationWm2: true,
        globalTiltedIrradianceWm2: true,
        observedAt: true,
        fetchedAt: true,
      },
    }),
    db.weatherForecastRun.findFirst({
      where: { siteId, provider },
      orderBy: { fetchedAt: "desc" },
      select: {
        fetchedAt: true,
        provider: true,
        modelSelection: true,
        attribution: true,
        points: {
          orderBy: { validAt: "asc" },
          take: 168,
          select: {
            validAt: true,
            condition: true,
            temperatureAirC: true,
            relativeHumidityPct: true,
            cloudCoverPct: true,
            precipitationProbabilityPct: true,
            precipitationMm: true,
            windSpeedKmh: true,
            shortwaveRadiationWm2: true,
            directNormalIrradianceWm2: true,
            globalTiltedIrradianceWm2: true,
          },
        },
      },
    }),
  ]);
  return { observation, forecastRun };
}
