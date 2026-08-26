import "dotenv/config";

import { db } from "../lib/db";
import { rollupSiteRange } from "../lib/telemetry/rollup-service";

const batchDays = Number(process.env.TELEMETRY_ROLLUP_BACKFILL_DAYS ?? 7);
if (!Number.isInteger(batchDays) || batchDays < 1 || batchDays > 31) throw new Error("TELEMETRY_ROLLUP_BACKFILL_DAYS must be an integer from 1 to 31.");

function floorQuarterHour(value: Date) {
  return new Date(Math.floor(value.getTime() / (15 * 60_000)) * 15 * 60_000);
}

async function main() {
  const sites = await db.solarSite.findMany({ where: { deletedAt: null }, orderBy: { createdAt: "asc" }, select: { id: true, name: true } });
  const results = [];
  for (const site of sites) {
    const bounds = await db.telemetryReading.aggregate({ where: { siteId: site.id }, _min: { observedAt: true }, _max: { observedAt: true }, _count: { _all: true } });
    if (!bounds._min.observedAt || !bounds._max.observedAt) {
      results.push({ siteId: site.id, siteName: site.name, rawReadings: 0, intervals: 0, days: 0 });
      continue;
    }
    let cursor = floorQuarterHour(bounds._min.observedAt);
    const finalTo = new Date(bounds._max.observedAt.getTime() + 15 * 60_000);
    let intervals = 0;
    let days = 0;
    while (cursor < finalTo) {
      const batchTo = new Date(Math.min(finalTo.getTime(), cursor.getTime() + batchDays * 86_400_000));
      const result = await rollupSiteRange(site.id, cursor, batchTo);
      intervals += result.intervalCount;
      days += result.dailyCount;
      cursor = batchTo;
    }
    results.push({ siteId: site.id, siteName: site.name, rawReadings: bounds._count._all, intervalsProcessed: intervals, dailyRowsRebuilt: days });
  }
  process.stdout.write(`${JSON.stringify({ completedAt: new Date().toISOString(), batchDays, sites: results }, null, 2)}\n`);
}

main().finally(() => db.$disconnect());
