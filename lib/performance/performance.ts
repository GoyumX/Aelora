export type PerformanceSource = "SIMULATED" | "HARDWARE";
export type PerformanceQuality = "SIMULATED" | "MEASURED" | "ESTIMATED" | "STALE" | "MISSING";
export type PerformanceConnectivity = "NEVER_SEEN" | "ONLINE" | "STALE" | "OFFLINE";
export type PerformanceOperationalState = "UNKNOWN" | "RUNNING" | "STANDBY" | "STOPPED" | "FAULT";

export type PerformanceReading = {
  observedAt: Date;
  pvPowerW: number;
  irradianceWm2: number;
  quality: PerformanceQuality;
};

export type PerformanceArrayObservation = {
  externalId: string;
  name: string;
  reportedAt: Date;
  connectivityStatus: PerformanceConnectivity;
  operationalState: PerformanceOperationalState;
  metrics: unknown;
};

export type PerformancePoint = {
  bucketStart: string;
  label: string;
  actualGenerationWh: number;
  expectedGenerationWh: number;
  estimatedLossWh: number;
};

export type ArrayPerformance = {
  id: string;
  name: string;
  ratedCapacityW: number;
  actualGenerationWh: number;
  expectedGenerationWh: number;
  performanceRatioPct: number | null;
  availabilityPct: number;
  observationCount: number;
  status: "HEALTHY" | "UNDERPERFORMING" | "INSUFFICIENT_DATA";
  explanation: string;
};

export type PerformanceReport = {
  site: { id: string; name: string; timezone: string };
  sourceLabel: "Simulated gateway data" | "Measured gateway data";
  range: { from: string; to: string; days: number };
  summary: {
    actualGenerationWh: number;
    expectedGenerationWh: number;
    performanceRatioPct: number | null;
    estimatedLossWh: number;
    availabilityPct: number;
    configuredCapacityW: number;
  };
  points: PerformancePoint[];
  arrays: ArrayPerformance[];
};

type PerformanceInput = {
  site: { id: string; name: string; timezone: string; source: PerformanceSource };
  arrays: Array<{ id: string; name: string; panelCount: number; ratedPowerW: number }>;
  inverter: { acRatingW: number; efficiencyPct: number } | null;
  range: { from: Date; to: Date };
  readings: PerformanceReading[];
  arrayObservations: PerformanceArrayObservation[];
  intervalMinutes: number;
};

function round(value: number, places = 0) {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

function percentage(actual: number, expected: number) {
  return expected > 0 ? round(actual / expected * 100, 1) : null;
}

function numericMetric(metrics: unknown, key: string) {
  if (!metrics || typeof metrics !== "object" || Array.isArray(metrics)) return null;
  const value = (metrics as Record<string, unknown>)[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function localDateKey(date: Date, timezone: string) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date).map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function labelForDate(key: string, timezone: string) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", timeZone: timezone }).format(new Date(`${key}T12:00:00.000Z`));
}

export function expectedPvPowerW(configuredCapacityW: number, irradianceWm2: number, inverter: { acRatingW: number; efficiencyPct: number } | null) {
  if (configuredCapacityW <= 0 || irradianceWm2 <= 0) return 0;
  const conversionEfficiency = Math.max(0, Math.min(100, inverter?.efficiencyPct ?? 100)) / 100;
  const modeledPowerW = configuredCapacityW * Math.min(1.5, irradianceWm2 / 1_000) * conversionEfficiency;
  return Math.max(0, Math.min(modeledPowerW, inverter?.acRatingW ?? modeledPowerW));
}

function buildPoints(input: PerformanceInput, configuredCapacityW: number) {
  const intervalHours = input.intervalMinutes / 60;
  const groups = new Map<string, PerformancePoint>();
  for (const reading of input.readings) {
    const key = localDateKey(reading.observedAt, input.site.timezone);
    const point = groups.get(key) ?? { bucketStart: `${key}T00:00:00.000Z`, label: labelForDate(key, input.site.timezone), actualGenerationWh: 0, expectedGenerationWh: 0, estimatedLossWh: 0 };
    point.actualGenerationWh += Math.max(0, reading.pvPowerW) * intervalHours;
    point.expectedGenerationWh += expectedPvPowerW(configuredCapacityW, reading.irradianceWm2, input.inverter) * intervalHours;
    groups.set(key, point);
  }
  return [...groups.values()].sort((left, right) => left.bucketStart.localeCompare(right.bucketStart)).map((point) => {
    const actualGenerationWh = round(point.actualGenerationWh);
    const expectedGenerationWh = round(point.expectedGenerationWh);
    return { ...point, actualGenerationWh, expectedGenerationWh, estimatedLossWh: Math.max(0, expectedGenerationWh - actualGenerationWh) };
  });
}

function buildArrayPerformance(input: PerformanceInput, configuredCapacityW: number) {
  const intervalHours = input.intervalMinutes / 60;
  const readingByTimestamp = new Map(input.readings.map((reading) => [reading.observedAt.getTime(), reading]));
  return input.arrays.map((array): ArrayPerformance => {
    const ratedCapacityW = array.panelCount * array.ratedPowerW;
    const observations = input.arrayObservations.filter((observation) => observation.name.trim().toLowerCase() === array.name.trim().toLowerCase());
    let actualGenerationWh = 0;
    let expectedGenerationWh = 0;
    let available = 0;
    for (const observation of observations) {
      const powerW = numericMetric(observation.metrics, "powerW");
      if (powerW !== null) actualGenerationWh += Math.max(0, powerW) * intervalHours;
      const reading = readingByTimestamp.get(observation.reportedAt.getTime());
      if (reading && configuredCapacityW > 0) expectedGenerationWh += expectedPvPowerW(configuredCapacityW, reading.irradianceWm2, input.inverter) * (ratedCapacityW / configuredCapacityW) * intervalHours;
      if (observation.connectivityStatus === "ONLINE" && observation.operationalState === "RUNNING") available += 1;
    }
    actualGenerationWh = round(actualGenerationWh);
    expectedGenerationWh = round(expectedGenerationWh);
    const availabilityPct = observations.length ? round(available / observations.length * 100, 1) : 0;
    const performanceRatioPct = percentage(actualGenerationWh, expectedGenerationWh);
    const enoughEvidence = observations.length >= 3 && expectedGenerationWh > 0;
    const status = !enoughEvidence ? "INSUFFICIENT_DATA" : availabilityPct < 90 || (performanceRatioPct ?? 0) < 80 ? "UNDERPERFORMING" : "HEALTHY";
    const explanation = status === "INSUFFICIENT_DATA"
      ? "Not enough matched array observations to assess this range."
      : status === "UNDERPERFORMING"
        ? availabilityPct < 90 ? "Reporting or operating availability is below 90%." : "Output is below 80% of the modeled range."
        : "Output and availability are within the modeled range.";
    return { id: observations[0]?.externalId ?? array.id, name: array.name, ratedCapacityW, actualGenerationWh, expectedGenerationWh, performanceRatioPct, availabilityPct, observationCount: observations.length, status, explanation };
  });
}

export function buildPerformanceReport(input: PerformanceInput): PerformanceReport {
  const configuredCapacityW = input.arrays.reduce((total, array) => total + array.panelCount * array.ratedPowerW, 0);
  const points = buildPoints(input, configuredCapacityW);
  const actualGenerationWh = points.reduce((total, point) => total + point.actualGenerationWh, 0);
  const expectedGenerationWh = points.reduce((total, point) => total + point.expectedGenerationWh, 0);
  const expectedSamples = Math.max(1, Math.round((input.range.to.getTime() - input.range.from.getTime()) / (input.intervalMinutes * 60_000)));
  const availableSamples = input.readings.filter((reading) => reading.quality !== "MISSING" && reading.quality !== "STALE").length;
  return {
    site: { id: input.site.id, name: input.site.name, timezone: input.site.timezone },
    sourceLabel: input.site.source === "HARDWARE" ? "Measured gateway data" : "Simulated gateway data",
    range: { from: input.range.from.toISOString(), to: input.range.to.toISOString(), days: Math.max(1, Math.round((input.range.to.getTime() - input.range.from.getTime()) / 86_400_000)) },
    summary: {
      actualGenerationWh,
      expectedGenerationWh,
      performanceRatioPct: percentage(actualGenerationWh, expectedGenerationWh),
      estimatedLossWh: Math.max(0, expectedGenerationWh - actualGenerationWh),
      availabilityPct: Math.min(100, round(availableSamples / expectedSamples * 100, 1)),
      configuredCapacityW,
    },
    points,
    arrays: buildArrayPerformance(input, configuredCapacityW),
  };
}
