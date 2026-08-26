import "server-only";

import { createTtlPromiseCache } from "@/lib/cache/ttl-promise-cache";
import { db } from "@/lib/db";
import { aggregateTelemetry, inferSampleIntervalMinutes, type HistoricalTelemetry, type HistoryGrain } from "@/lib/telemetry/history";

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
  };
}

export function getHistoricalTelemetry(site: { id: string; name: string; timezone: string }, from: Date, to: Date, grain: HistoryGrain): Promise<HistoricalTelemetry> {
  const key = [site.id, site.timezone, from.toISOString(), to.toISOString(), grain].join(":");
  return historyCache.get(key, () => calculateHistoricalTelemetry(site, from, to, grain));
}
