import "server-only";

import { createTtlPromiseCache } from "@/lib/cache/ttl-promise-cache";
import { db } from "@/lib/db";
import { aggregateDailyTelemetry, aggregateTelemetry, inferSampleIntervalMinutes, type HistoricalTelemetry, type HistoryGrain } from "@/lib/telemetry/history";

const historyCache = createTtlPromiseCache<HistoricalTelemetry>({
  ttlMs: 60_000,
  maxEntries: 32,
});

function percentageChange(current: number, previous: number) {
  if (!previous) return null;
  return Math.round((current - previous) / previous * 1000) / 10;
}

async function calculateHistoricalTelemetry(site: { id: string; name: string; timezone: string }, from: Date, to: Date, grain: HistoryGrain): Promise<HistoricalTelemetry> {
  const duration = to.getTime() - from.getTime();
  const previousFrom = new Date(from.getTime() - duration);
  if (duration >= 7 * 86_400_000) {
    const selectDaily = { localDate: true, dayStartAt: true, dayEndAt: true, generationWh: true, consumptionWh: true, importWh: true, exportWh: true, batteryChargeWh: true, batteryDischargeWh: true, averageIrradianceWm2: true, sampleCount: true, coveredDurationSec: true } as const;
    const [daily, previousDaily] = await Promise.all([
      db.telemetryRollupDaily.findMany({ where: { siteId: site.id, dayStartAt: { gte: from, lt: to } }, orderBy: { dayStartAt: "asc" }, select: selectDaily }),
      db.telemetryRollupDaily.findMany({ where: { siteId: site.id, dayStartAt: { gte: previousFrom, lt: from } }, orderBy: { dayStartAt: "asc" }, select: selectDaily }),
    ]);
    if (daily.length) {
      const current = aggregateDailyTelemetry(daily, grain, site.timezone, from, to);
      const previous = aggregateDailyTelemetry(previousDaily, grain, site.timezone, previousFrom, from);
      return {
        site,
        range: { from: from.toISOString(), to: to.toISOString(), grain },
        ...current,
        comparison: {
          generationChangePct: percentageChange(current.summary.generationWh, previous.summary.generationWh),
          consumptionChangePct: percentageChange(current.summary.consumptionWh, previous.summary.consumptionWh),
        },
        dataResolution: "DAILY_ROLLUP",
      };
    }
  }
  const select = { observedAt: true, pvPowerW: true, loadPowerW: true, gridPowerW: true, batteryPowerW: true, irradianceWm2: true, quality: true } as const;
  const [readings, previousReadings] = await Promise.all([
    db.telemetryReading.findMany({ where: { siteId: site.id, observedAt: { gte: from, lt: to } }, orderBy: { observedAt: "asc" }, select }),
    db.telemetryReading.findMany({ where: { siteId: site.id, observedAt: { gte: previousFrom, lt: from } }, orderBy: { observedAt: "asc" }, select }),
  ]);
  const intervalMinutes = inferSampleIntervalMinutes(readings);
  const current = aggregateTelemetry(readings, grain, site.timezone, from, to, intervalMinutes);
  const previous = aggregateTelemetry(previousReadings, grain, site.timezone, previousFrom, from, inferSampleIntervalMinutes(previousReadings, intervalMinutes));
  return {
    site,
    range: { from: from.toISOString(), to: to.toISOString(), grain },
    ...current,
    comparison: {
      generationChangePct: percentageChange(current.summary.generationWh, previous.summary.generationWh),
      consumptionChangePct: percentageChange(current.summary.consumptionWh, previous.summary.consumptionWh),
    },
    dataResolution: "RAW_TELEMETRY",
  };
}

export function getHistoricalTelemetry(site: { id: string; name: string; timezone: string }, from: Date, to: Date, grain: HistoryGrain): Promise<HistoricalTelemetry> {
  const key = [site.id, site.timezone, from.toISOString(), to.toISOString(), grain].join(":");
  return historyCache.get(key, () => calculateHistoricalTelemetry(site, from, to, grain));
}
