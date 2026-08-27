import "server-only";

import type { Prisma } from "@prisma/client";

import { createTtlPromiseCache } from "@/lib/cache/ttl-promise-cache";
import { db } from "@/lib/db";
import { buildPerformanceReport, type PerformanceReport } from "@/lib/performance/performance";
import { inferSampleIntervalMinutes } from "@/lib/telemetry/history";

const performanceCache = createTtlPromiseCache<PerformanceReport | null>({
  ttlMs: 60_000,
  maxEntries: 32,
});

async function getPerformanceReport(where: Prisma.SolarSiteWhereInput, from: Date, to: Date): Promise<PerformanceReport | null> {
  const site = await db.solarSite.findFirst({
    where,
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      timezone: true,
      mode: true,
      arrays: {
        where: { status: "ACTIVE", archivedAt: null },
        orderBy: { createdAt: "asc" },
        select: { id: true, name: true, panelCount: true, ratedPowerW: true },
      },
      inverters: {
        where: { status: "ACTIVE", archivedAt: null },
        orderBy: { createdAt: "asc" },
        take: 1,
        select: { acRatingW: true, efficiencyPct: true },
      },
      gateways: {
        where: { revokedAt: null },
        select: {
          devices: {
            where: { kind: "PV_ARRAY" },
            select: {
              externalId: true,
              name: true,
              observations: {
                where: { reportedAt: { gte: from, lt: to } },
                orderBy: { reportedAt: "asc" },
                select: { reportedAt: true, connectivityStatus: true, operationalState: true, metrics: true },
              },
            },
          },
        },
      },
    },
  });
  if (!site) return null;

  const readings = await db.telemetryReading.findMany({
    where: { siteId: site.id, observedAt: { gte: from, lt: to } },
    orderBy: { observedAt: "asc" },
    select: { observedAt: true, pvPowerW: true, irradianceWm2: true, quality: true },
  });
  const intervalMinutes = inferSampleIntervalMinutes(readings);
  const arrayObservations = site.gateways.flatMap((gateway) => gateway.devices.flatMap((device) => device.observations.map((observation) => ({
    externalId: device.externalId,
    name: device.name,
    ...observation,
  }))));

  return buildPerformanceReport({
    site: { id: site.id, name: site.name, timezone: site.timezone, source: site.mode },
    arrays: site.arrays,
    inverter: site.inverters[0] ?? null,
    range: { from, to },
    readings,
    arrayObservations,
    intervalMinutes,
  });
}

export function getOwnedPerformanceReport(ownerId: string, from: Date, to: Date) {
  const key = ["owner", ownerId, from.toISOString(), to.toISOString()].join(":");
  return performanceCache.get(key, () => getPerformanceReport({ ownerId, deletedAt: null }, from, to));
}

export function getSitePerformanceReport(siteId: string, from: Date, to: Date) {
  const key = ["site", siteId, from.toISOString(), to.toISOString()].join(":");
  return performanceCache.get(key, () => getPerformanceReport({ id: siteId, deletedAt: null }, from, to));
}
