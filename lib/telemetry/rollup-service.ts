import "server-only";

import type { Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import {
  buildDailyRollups,
  buildFifteenMinuteRollups,
  compareRollupTotals,
  type DailyRollup,
  type FifteenMinuteRollup,
  type RollupTotals,
} from "@/lib/telemetry/rollup";

const readingSelect = {
  observedAt: true,
  pvPowerW: true,
  loadPowerW: true,
  gridPowerW: true,
  batteryPowerW: true,
  irradianceWm2: true,
  quality: true,
} as const;

function intervalData(row: FifteenMinuteRollup) {
  return {
    bucketEnd: row.bucketEnd,
    generationWh: row.generationWh,
    consumptionWh: row.consumptionWh,
    importWh: row.importWh,
    exportWh: row.exportWh,
    batteryChargeWh: row.batteryChargeWh,
    batteryDischargeWh: row.batteryDischargeWh,
    averagePvPowerW: row.averagePvPowerW,
    peakPvPowerW: row.peakPvPowerW,
    averageLoadPowerW: row.averageLoadPowerW,
    peakLoadPowerW: row.peakLoadPowerW,
    averageIrradianceWm2: row.averageIrradianceWm2,
    sampleCount: row.sampleCount,
    expectedSampleCount: row.expectedSampleCount,
    expectedIntervalSec: row.expectedIntervalSec,
    coveredDurationSec: row.coveredDurationSec,
    coveragePct: row.coveragePct,
    maxGapSec: row.maxGapSec,
    evidenceQuality: row.evidenceQuality,
    firstObservedAt: row.firstObservedAt,
    lastObservedAt: row.lastObservedAt,
    calculatedAt: new Date(),
  };
}

function dailyData(row: DailyRollup, timezone: string) {
  return {
    timezone,
    dayStartAt: row.dayStartAt,
    dayEndAt: row.dayEndAt,
    generationWh: row.generationWh,
    consumptionWh: row.consumptionWh,
    importWh: row.importWh,
    exportWh: row.exportWh,
    batteryChargeWh: row.batteryChargeWh,
    batteryDischargeWh: row.batteryDischargeWh,
    averagePvPowerW: row.averagePvPowerW,
    peakPvPowerW: row.peakPvPowerW,
    averageLoadPowerW: row.averageLoadPowerW,
    peakLoadPowerW: row.peakLoadPowerW,
    averageIrradianceWm2: row.averageIrradianceWm2,
    intervalCount: row.intervalCount,
    completeIntervalCount: row.completeIntervalCount,
    sampleCount: row.sampleCount,
    expectedSampleCount: row.expectedSampleCount,
    expectedIntervalSec: row.expectedIntervalSec,
    coveredDurationSec: row.coveredDurationSec,
    coveragePct: row.coveragePct,
    maxGapSec: row.maxGapSec,
    evidenceQuality: row.evidenceQuality,
    firstObservedAt: row.firstObservedAt,
    lastObservedAt: row.lastObservedAt,
    calculatedAt: new Date(),
  };
}

async function loadRollupInput(siteId: string, from: Date, to: Date) {
  if (from >= to) throw new RangeError("Roll-up end time must be after its start time.");
  const site = await db.solarSite.findUnique({
    where: { id: siteId },
    select: {
      id: true,
      timezone: true,
      gateways: {
        where: { revokedAt: null },
        orderBy: { createdAt: "asc" },
        take: 1,
        select: { expectedIntervalSec: true },
      },
    },
  });
  if (!site) throw new Error("Solar site was not found.");
  const readings = await db.telemetryReading.findMany({
    where: { siteId, observedAt: { gte: from, lt: to } },
    orderBy: { observedAt: "asc" },
    select: readingSelect,
  });
  return { site, readings, expectedIntervalSec: site.gateways[0]?.expectedIntervalSec ?? 30 };
}

export async function rollupSiteRange(siteId: string, from: Date, to: Date) {
  const { site, readings, expectedIntervalSec } = await loadRollupInput(siteId, from, to);
  const intervals = buildFifteenMinuteRollups(readings, expectedIntervalSec);
  const days = buildDailyRollups(intervals, site.timezone);
  if (intervals.length || days.length) {
    await db.$transaction(async (transaction: Prisma.TransactionClient) => {
      for (const row of intervals) {
        const data = intervalData(row);
        await transaction.telemetryRollup15Minute.upsert({
          where: { siteId_bucketStart: { siteId, bucketStart: row.bucketStart } },
          create: { siteId, bucketStart: row.bucketStart, ...data },
          update: data,
        });
      }
      for (const row of days) {
        const localDate = new Date(`${row.localDate}T00:00:00.000Z`);
        const data = dailyData(row, site.timezone);
        await transaction.telemetryRollupDaily.upsert({
          where: { siteId_localDate: { siteId, localDate } },
          create: { siteId, localDate, ...data },
          update: data,
        });
      }
    });
  }
  return { siteId, from: from.toISOString(), to: to.toISOString(), rawReadingCount: readings.length, intervalCount: intervals.length, dailyCount: days.length };
}

function sumTotals(rows: RollupTotals[]): RollupTotals {
  return rows.reduce((sum, row) => ({
    generationWh: sum.generationWh + row.generationWh,
    consumptionWh: sum.consumptionWh + row.consumptionWh,
    importWh: sum.importWh + row.importWh,
    exportWh: sum.exportWh + row.exportWh,
    batteryChargeWh: sum.batteryChargeWh + row.batteryChargeWh,
    batteryDischargeWh: sum.batteryDischargeWh + row.batteryDischargeWh,
    coveredDurationSec: sum.coveredDurationSec + row.coveredDurationSec,
  }), { generationWh: 0, consumptionWh: 0, importWh: 0, exportWh: 0, batteryChargeWh: 0, batteryDischargeWh: 0, coveredDurationSec: 0 });
}

export async function reconcileSiteRollups(siteId: string, from: Date, to: Date) {
  const { readings, expectedIntervalSec } = await loadRollupInput(siteId, from, to);
  const expected = buildFifteenMinuteRollups(readings, expectedIntervalSec);
  const stored = await db.telemetryRollup15Minute.findMany({
    where: { siteId, bucketStart: { gte: from, lt: to } },
    orderBy: { bucketStart: "asc" },
    select: { generationWh: true, consumptionWh: true, importWh: true, exportWh: true, batteryChargeWh: true, batteryDischargeWh: true, coveredDurationSec: true },
  });
  const comparison = compareRollupTotals(sumTotals(expected), sumTotals(stored));
  const differences = [...comparison.differences];
  if (expected.length !== stored.length) differences.unshift(`Expected ${expected.length} interval rows but found ${stored.length}.`);
  return {
    passed: differences.length === 0,
    siteId,
    from: from.toISOString(),
    to: to.toISOString(),
    rawReadingCount: readings.length,
    expectedIntervalCount: expected.length,
    storedIntervalCount: stored.length,
    differences,
  };
}
