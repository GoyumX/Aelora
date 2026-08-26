import { localDayRange } from "@/lib/time/zoned";

const FIFTEEN_MINUTES_MS = 15 * 60 * 1_000;
const VALID_QUALITIES = new Set(["SIMULATED", "MEASURED", "ESTIMATED"]);

export type RollupEvidenceQuality = "SIMULATED" | "MEASURED" | "ESTIMATED" | "MIXED";

export type RollupReading = {
  observedAt: Date;
  pvPowerW: number;
  loadPowerW: number;
  gridPowerW: number;
  batteryPowerW: number;
  irradianceWm2: number;
  quality: "SIMULATED" | "MEASURED" | "ESTIMATED" | "STALE" | "MISSING";
};

export type RollupTotals = {
  generationWh: number;
  consumptionWh: number;
  importWh: number;
  exportWh: number;
  batteryChargeWh: number;
  batteryDischargeWh: number;
  coveredDurationSec: number;
};

export type FifteenMinuteRollup = RollupTotals & {
  bucketStart: Date;
  bucketEnd: Date;
  averagePvPowerW: number;
  peakPvPowerW: number;
  averageLoadPowerW: number;
  peakLoadPowerW: number;
  averageIrradianceWm2: number;
  sampleCount: number;
  expectedSampleCount: number;
  expectedIntervalSec: number;
  coveragePct: number;
  maxGapSec: number;
  evidenceQuality: RollupEvidenceQuality;
  firstObservedAt: Date;
  lastObservedAt: Date;
};

export type DailyRollup = RollupTotals & {
  localDate: string;
  dayStartAt: Date;
  dayEndAt: Date;
  averagePvPowerW: number;
  peakPvPowerW: number;
  averageLoadPowerW: number;
  peakLoadPowerW: number;
  averageIrradianceWm2: number;
  intervalCount: number;
  completeIntervalCount: number;
  sampleCount: number;
  expectedSampleCount: number;
  expectedIntervalSec: number;
  coveragePct: number;
  maxGapSec: number;
  evidenceQuality: RollupEvidenceQuality;
  firstObservedAt: Date;
  lastObservedAt: Date;
};

type MutableFifteenMinuteRollup = Omit<FifteenMinuteRollup,
  | keyof RollupTotals
  | "averagePvPowerW"
  | "averageLoadPowerW"
  | "averageIrradianceWm2"
  | "coveragePct"
  | "evidenceQuality"
> & RollupTotals & {
  pvPowerWSeconds: number;
  loadPowerWSeconds: number;
  irradianceWm2Seconds: number;
  qualities: Set<RollupEvidenceQuality>;
};

function round(value: number, digits = 0) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function floorToFifteenMinutes(value: Date) {
  return new Date(Math.floor(value.getTime() / FIFTEEN_MINUTES_MS) * FIFTEEN_MINUTES_MS);
}

function localDateKey(value: Date, timezone: string) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value).map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function evidenceQuality(qualities: Iterable<RollupEvidenceQuality>): RollupEvidenceQuality {
  const distinct = new Set(qualities);
  if (distinct.size === 1) return [...distinct][0];
  return "MIXED";
}

function initialBucket(bucketStart: Date, expectedIntervalSec: number): MutableFifteenMinuteRollup {
  return {
    bucketStart,
    bucketEnd: new Date(bucketStart.getTime() + FIFTEEN_MINUTES_MS),
    generationWh: 0,
    consumptionWh: 0,
    importWh: 0,
    exportWh: 0,
    batteryChargeWh: 0,
    batteryDischargeWh: 0,
    coveredDurationSec: 0,
    pvPowerWSeconds: 0,
    loadPowerWSeconds: 0,
    irradianceWm2Seconds: 0,
    peakPvPowerW: 0,
    peakLoadPowerW: 0,
    sampleCount: 0,
    expectedSampleCount: Math.round(15 * 60 / expectedIntervalSec),
    expectedIntervalSec,
    maxGapSec: 0,
    qualities: new Set(),
    firstObservedAt: new Date(8.64e15),
    lastObservedAt: new Date(-8.64e15),
  };
}

export function buildFifteenMinuteRollups(readings: RollupReading[], expectedIntervalSec: number): FifteenMinuteRollup[] {
  if (!Number.isFinite(expectedIntervalSec) || expectedIntervalSec <= 0 || expectedIntervalSec > 15 * 60) {
    throw new RangeError("Expected telemetry interval must be between 1 and 900 seconds.");
  }

  const valid = readings
    .filter((item) => VALID_QUALITIES.has(item.quality) && !Number.isNaN(item.observedAt.getTime()))
    .sort((left, right) => left.observedAt.getTime() - right.observedAt.getTime());
  const buckets = new Map<number, MutableFifteenMinuteRollup>();

  valid.forEach((item, index) => {
    const next = valid[index + 1];
    const observedGapSec = next
      ? Math.max(0, (next.observedAt.getTime() - item.observedAt.getTime()) / 1_000)
      : expectedIntervalSec;
    const evidencedDurationSec = Math.min(expectedIntervalSec, observedGapSec || expectedIntervalSec);
    if (evidencedDurationSec <= 0) return;

    const startBucketKey = floorToFifteenMinutes(item.observedAt).getTime();
    const startBucket = buckets.get(startBucketKey) ?? initialBucket(new Date(startBucketKey), expectedIntervalSec);
    startBucket.sampleCount += 1;
    startBucket.maxGapSec = Math.max(startBucket.maxGapSec, round(observedGapSec));
    startBucket.firstObservedAt = new Date(Math.min(startBucket.firstObservedAt.getTime(), item.observedAt.getTime()));
    startBucket.lastObservedAt = new Date(Math.max(startBucket.lastObservedAt.getTime(), item.observedAt.getTime()));
    buckets.set(startBucketKey, startBucket);

    let segmentStartMs = item.observedAt.getTime();
    const intervalEndMs = segmentStartMs + evidencedDurationSec * 1_000;
    while (segmentStartMs < intervalEndMs) {
      const bucketStart = floorToFifteenMinutes(new Date(segmentStartMs));
      const bucketKey = bucketStart.getTime();
      const bucketEndMs = bucketKey + FIFTEEN_MINUTES_MS;
      const segmentEndMs = Math.min(intervalEndMs, bucketEndMs);
      const durationSec = (segmentEndMs - segmentStartMs) / 1_000;
      const bucket = buckets.get(bucketKey) ?? initialBucket(bucketStart, expectedIntervalSec);
      const hours = durationSec / 3_600;

      bucket.generationWh += Math.max(0, item.pvPowerW) * hours;
      bucket.consumptionWh += Math.max(0, item.loadPowerW) * hours;
      bucket.importWh += Math.max(0, item.gridPowerW) * hours;
      bucket.exportWh += Math.max(0, -item.gridPowerW) * hours;
      bucket.batteryChargeWh += Math.max(0, -item.batteryPowerW) * hours;
      bucket.batteryDischargeWh += Math.max(0, item.batteryPowerW) * hours;
      bucket.coveredDurationSec += durationSec;
      bucket.pvPowerWSeconds += Math.max(0, item.pvPowerW) * durationSec;
      bucket.loadPowerWSeconds += Math.max(0, item.loadPowerW) * durationSec;
      bucket.irradianceWm2Seconds += Math.max(0, item.irradianceWm2) * durationSec;
      bucket.peakPvPowerW = Math.max(bucket.peakPvPowerW, Math.max(0, item.pvPowerW));
      bucket.peakLoadPowerW = Math.max(bucket.peakLoadPowerW, Math.max(0, item.loadPowerW));
      bucket.qualities.add(item.quality as RollupEvidenceQuality);
      if (bucket.firstObservedAt.getTime() === 8.64e15) bucket.firstObservedAt = new Date(segmentStartMs);
      if (bucket.lastObservedAt.getTime() === -8.64e15) bucket.lastObservedAt = new Date(segmentStartMs);
      buckets.set(bucketKey, bucket);
      segmentStartMs = segmentEndMs;
    }
  });

  return [...buckets.values()]
    .sort((left, right) => left.bucketStart.getTime() - right.bucketStart.getTime())
    .map(({ pvPowerWSeconds, loadPowerWSeconds, irradianceWm2Seconds, qualities, ...bucket }) => ({
      ...bucket,
      generationWh: round(bucket.generationWh),
      consumptionWh: round(bucket.consumptionWh),
      importWh: round(bucket.importWh),
      exportWh: round(bucket.exportWh),
      batteryChargeWh: round(bucket.batteryChargeWh),
      batteryDischargeWh: round(bucket.batteryDischargeWh),
      coveredDurationSec: round(bucket.coveredDurationSec),
      averagePvPowerW: bucket.coveredDurationSec ? round(pvPowerWSeconds / bucket.coveredDurationSec) : 0,
      averageLoadPowerW: bucket.coveredDurationSec ? round(loadPowerWSeconds / bucket.coveredDurationSec) : 0,
      averageIrradianceWm2: bucket.coveredDurationSec ? round(irradianceWm2Seconds / bucket.coveredDurationSec) : 0,
      coveragePct: round(Math.min(100, bucket.coveredDurationSec / (15 * 60) * 100), 2),
      evidenceQuality: evidenceQuality(qualities),
    }));
}

export function buildDailyRollups(intervals: FifteenMinuteRollup[], timezone: string): DailyRollup[] {
  const groups = new Map<string, FifteenMinuteRollup[]>();
  for (const interval of intervals) {
    const key = localDateKey(interval.bucketStart, timezone);
    groups.set(key, [...(groups.get(key) ?? []), interval]);
  }

  return [...groups.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([localDate, rows]) => {
    const { from: dayStartAt, to: dayEndAt } = localDayRange(localDate, timezone);
    const expectedIntervalSec = Math.min(...rows.map((row) => row.expectedIntervalSec));
    const totals = rows.reduce<RollupTotals>((sum, row) => ({
      generationWh: sum.generationWh + row.generationWh,
      consumptionWh: sum.consumptionWh + row.consumptionWh,
      importWh: sum.importWh + row.importWh,
      exportWh: sum.exportWh + row.exportWh,
      batteryChargeWh: sum.batteryChargeWh + row.batteryChargeWh,
      batteryDischargeWh: sum.batteryDischargeWh + row.batteryDischargeWh,
      coveredDurationSec: sum.coveredDurationSec + row.coveredDurationSec,
    }), { generationWh: 0, consumptionWh: 0, importWh: 0, exportWh: 0, batteryChargeWh: 0, batteryDischargeWh: 0, coveredDurationSec: 0 });
    const weighted = rows.reduce((sum, row) => ({
      pv: sum.pv + row.averagePvPowerW * row.coveredDurationSec,
      load: sum.load + row.averageLoadPowerW * row.coveredDurationSec,
      irradiance: sum.irradiance + row.averageIrradianceWm2 * row.coveredDurationSec,
    }), { pv: 0, load: 0, irradiance: 0 });
    const dayDurationSec = (dayEndAt.getTime() - dayStartAt.getTime()) / 1_000;

    return {
      localDate,
      dayStartAt,
      dayEndAt,
      ...totals,
      averagePvPowerW: totals.coveredDurationSec ? round(weighted.pv / totals.coveredDurationSec) : 0,
      peakPvPowerW: Math.max(...rows.map((row) => row.peakPvPowerW)),
      averageLoadPowerW: totals.coveredDurationSec ? round(weighted.load / totals.coveredDurationSec) : 0,
      peakLoadPowerW: Math.max(...rows.map((row) => row.peakLoadPowerW)),
      averageIrradianceWm2: totals.coveredDurationSec ? round(weighted.irradiance / totals.coveredDurationSec) : 0,
      intervalCount: rows.length,
      completeIntervalCount: rows.filter((row) => row.coveragePct >= 99.5).length,
      sampleCount: rows.reduce((sum, row) => sum + row.sampleCount, 0),
      expectedSampleCount: Math.round(dayDurationSec / expectedIntervalSec),
      expectedIntervalSec,
      coveragePct: round(Math.min(100, totals.coveredDurationSec / dayDurationSec * 100), 2),
      maxGapSec: Math.max(...rows.map((row) => row.maxGapSec)),
      evidenceQuality: evidenceQuality(rows.map((row) => row.evidenceQuality)),
      firstObservedAt: new Date(Math.min(...rows.map((row) => row.firstObservedAt.getTime()))),
      lastObservedAt: new Date(Math.max(...rows.map((row) => row.lastObservedAt.getTime()))),
    };
  });
}

export function compareRollupTotals(expected: RollupTotals, actual: RollupTotals) {
  const differences: string[] = [];
  for (const field of ["generationWh", "consumptionWh", "importWh", "exportWh", "batteryChargeWh", "batteryDischargeWh", "coveredDurationSec"] as const) {
    const difference = actual[field] - expected[field];
    if (difference !== 0) differences.push(`${field} expected ${expected[field]} but found ${actual[field]} (difference ${difference}).`);
  }
  return { passed: differences.length === 0, differences };
}

export function evaluateRetentionDryRun(input: {
  policyReady: boolean;
  reconciliationPassed: boolean;
  eligibleRawRows: number;
  rawRowsMissingRollup: number;
}) {
  const reasons: string[] = [];
  if (!input.policyReady) reasons.push("Backup, schema, or retention policy prerequisites are not satisfied.");
  if (!input.reconciliationPassed) reasons.push("The latest telemetry roll-up reconciliation did not pass.");
  if (input.rawRowsMissingRollup > 0) {
    reasons.push(`${input.rawRowsMissingRollup} eligible raw telemetry rows do not have a corresponding 15-minute roll-up.`);
  }
  return { allowed: reasons.length === 0, wouldDeleteRows: input.eligibleRawRows, reasons };
}
