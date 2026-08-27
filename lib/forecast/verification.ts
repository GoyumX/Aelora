export type ForecastActualQuality = "SIMULATED" | "MEASURED" | "ESTIMATED" | "MIXED";
export type HorizonKey = "H24" | "H48" | "H168";

export type ForecastVerificationSample = {
  forecastPointId: string;
  artifactSha256: string;
  forecastIssuedAt: string;
  validAt: string;
  leadHours: number;
  estimatedEnergyKwh: number;
  actualEnergyKwh: number;
  actualQuality: ForecastActualQuality;
};

export type ForecastMetricSummary = {
  sampleCount: number;
  maeKwh: number | null;
  rmseKwh: number | null;
  biasKwh: number | null;
  wMapePct: number | null;
  meanActualEnergyKwh: number | null;
};

export type ForecastMetricSlice = ForecastMetricSummary & {
  key: HorizonKey;
  label: string;
};

export type ForecastCalibrationSlice = {
  key: HorizonKey;
  label: string;
  sampleCount: number;
  status: "READY" | "COLLECTING";
  halfWidthKwh: number | null;
  coverageTargetPct: 90;
};

export type ForecastPromotionStatus =
  | "INSUFFICIENT_EVIDENCE"
  | "BLOCKED_SIMULATED_EVIDENCE"
  | "BLOCKED_NON_MEASURED_EVIDENCE"
  | "GATES_FAILED"
  | "REVIEW_REQUIRED";

export type ForecastEvaluationAnalysis = {
  deduplicatedCount: number;
  excludedNightCount: number;
  evidenceQuality: ForecastActualQuality | "NONE";
  overall: ForecastMetricSummary;
  slices: ForecastMetricSlice[];
  calibration: ForecastCalibrationSlice[];
  promotion: {
    status: ForecastPromotionStatus;
    automaticActivationAllowed: false;
    reasons: string[];
  };
};

export type ForecastEvaluationView = ForecastEvaluationAnalysis & {
  siteId: string;
  evaluatedAt: string;
};

type TelemetryLabelReading = {
  observedAt: Date;
  pvPowerW: number;
  quality: "SIMULATED" | "MEASURED" | "ESTIMATED" | "STALE" | "MISSING";
};

const minimumCoveragePct = 95;
const minimumCalibrationSamples = 24;
const activeEnergyThresholdKwh = 0.05;
const horizonDefinitions: Array<{ key: HorizonKey; label: string; includes: (leadHours: number) => boolean }> = [
  { key: "H24", label: "1–24 hours", includes: (leadHours) => leadHours <= 24 },
  { key: "H48", label: "25–48 hours", includes: (leadHours) => leadHours > 24 && leadHours <= 48 },
  { key: "H168", label: "49–168 hours", includes: (leadHours) => leadHours > 48 && leadHours <= 168 },
];

function round(value: number, places = 3) {
  const factor = 10 ** places;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function actualQuality(readings: TelemetryLabelReading[]): ForecastActualQuality | null {
  const qualities = new Set(readings.map((reading) => reading.quality));
  if (!qualities.size) return null;
  if (qualities.size > 1) return "MIXED";
  return [...qualities][0] as ForecastActualQuality;
}

export function integrateGenerationInterval(
  readings: TelemetryLabelReading[],
  start: Date,
  end: Date,
  expectedIntervalSec: number,
) {
  const unique = new Map<number, TelemetryLabelReading>();
  for (const reading of readings) {
    const timestamp = reading.observedAt.getTime();
    if (
      timestamp >= start.getTime()
      && timestamp < end.getTime()
      && reading.quality !== "STALE"
      && reading.quality !== "MISSING"
    ) {
      unique.set(timestamp, reading);
    }
  }
  const usable = [...unique.values()];
  const durationSec = Math.max(0, (end.getTime() - start.getTime()) / 1_000);
  const expectedSamples = Math.max(1, Math.round(durationSec / expectedIntervalSec));
  const coveragePct = round(Math.min(100, usable.length / expectedSamples * 100), 2);
  const eligible = coveragePct >= minimumCoveragePct;
  const quality = actualQuality(usable);
  const actualEnergyKwh = eligible
    ? round(usable.reduce((total, reading) => (
        total + reading.pvPowerW * expectedIntervalSec / 3_600_000
      ), 0))
    : null;

  return {
    eligible,
    actualEnergyKwh,
    coveragePct,
    sampleCount: usable.length,
    sampleIntervalSec: expectedIntervalSec,
    actualQuality: quality,
  };
}

function metricSummary(samples: ForecastVerificationSample[]): ForecastMetricSummary {
  if (!samples.length) {
    return {
      sampleCount: 0,
      maeKwh: null,
      rmseKwh: null,
      biasKwh: null,
      wMapePct: null,
      meanActualEnergyKwh: null,
    };
  }
  const errors = samples.map((sample) => sample.estimatedEnergyKwh - sample.actualEnergyKwh);
  const absoluteErrors = errors.map(Math.abs);
  const actualTotal = samples.reduce((total, sample) => total + sample.actualEnergyKwh, 0);
  return {
    sampleCount: samples.length,
    maeKwh: round(absoluteErrors.reduce((total, value) => total + value, 0) / samples.length),
    rmseKwh: round(Math.sqrt(errors.reduce((total, value) => total + value ** 2, 0) / samples.length)),
    biasKwh: round(errors.reduce((total, value) => total + value, 0) / samples.length),
    wMapePct: actualTotal > 0
      ? round(absoluteErrors.reduce((total, value) => total + value, 0) / actualTotal * 100, 1)
      : null,
    meanActualEnergyKwh: round(actualTotal / samples.length),
  };
}

function quantile90(values: number[]) {
  const ordered = [...values].sort((left, right) => left - right);
  const index = Math.min(ordered.length - 1, Math.ceil((ordered.length + 1) * 0.9) - 1);
  return round(ordered[Math.max(0, index)]);
}

function combinedQuality(samples: ForecastVerificationSample[]): ForecastActualQuality | "NONE" {
  const qualities = new Set(samples.map((sample) => sample.actualQuality));
  if (!qualities.size) return "NONE";
  if (qualities.size > 1) return "MIXED";
  return [...qualities][0];
}

function localDate(value: string, timezone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

function promotionResult(
  samples: ForecastVerificationSample[],
  slices: ForecastMetricSlice[],
  overall: ForecastMetricSummary,
  evidenceQuality: ForecastActualQuality | "NONE",
  timezone: string,
): ForecastEvaluationAnalysis["promotion"] {
  const result = (status: ForecastPromotionStatus, reasons: string[]) => ({
    status,
    automaticActivationAllowed: false as const,
    reasons,
  });
  if (evidenceQuality === "SIMULATED") {
    return result("BLOCKED_SIMULATED_EVIDENCE", ["Simulated telemetry cannot promote a production model."]);
  }
  if (evidenceQuality !== "MEASURED" && evidenceQuality !== "NONE") {
    return result("BLOCKED_NON_MEASURED_EVIDENCE", ["Mixed or estimated telemetry cannot promote a production model."]);
  }
  const distinctDates = new Set(samples.map((sample) => localDate(sample.validAt, timezone))).size;
  const readinessReasons = [
    ...(samples.length < 100 ? [`Need ${100 - samples.length} more measured daylight labels.`] : []),
    ...(distinctDates < 14 ? [`Need evidence across ${14 - distinctDates} more local dates.`] : []),
    ...slices.filter((slice) => slice.sampleCount < minimumCalibrationSamples).map((slice) => `${slice.label} needs ${minimumCalibrationSamples - slice.sampleCount} more labels.`),
  ];
  if (readinessReasons.length) return result("INSUFFICIENT_EVIDENCE", readinessReasons);

  const meanActual = overall.meanActualEnergyKwh ?? 0;
  const gateReasons = [
    ...((overall.wMapePct ?? Number.POSITIVE_INFINITY) > 20 ? ["wMAPE exceeds the 20% review gate."] : []),
    ...(Math.abs(overall.biasKwh ?? Number.POSITIVE_INFINITY) > meanActual * 0.1 ? ["Absolute bias exceeds 10% of mean actual energy."] : []),
  ];
  return gateReasons.length
    ? result("GATES_FAILED", gateReasons)
    : result("REVIEW_REQUIRED", ["Automated gates passed; a human administrator must review the evidence."]);
}

export function horizonKey(leadHours: number): HorizonKey {
  return horizonDefinitions.find((definition) => definition.includes(leadHours))?.key ?? "H168";
}

export function evaluateForecastSamples(
  input: ForecastVerificationSample[],
  timezone: string,
): ForecastEvaluationAnalysis {
  const unique = new Map<string, ForecastVerificationSample>();
  for (const sample of input) {
    const key = `${sample.artifactSha256}:${sample.forecastIssuedAt}:${sample.validAt}`;
    if (!unique.has(key)) unique.set(key, sample);
  }
  const deduplicated = [...unique.values()];
  const active = deduplicated.filter((sample) => (
    sample.estimatedEnergyKwh >= activeEnergyThresholdKwh
    || sample.actualEnergyKwh >= activeEnergyThresholdKwh
  ));
  const overall = metricSummary(active);
  const slices = horizonDefinitions.map((definition) => ({
    key: definition.key,
    label: definition.label,
    ...metricSummary(active.filter((sample) => definition.includes(sample.leadHours))),
  }));
  const calibration = horizonDefinitions.map((definition): ForecastCalibrationSlice => {
    const sliceSamples = active.filter((sample) => definition.includes(sample.leadHours));
    return {
      key: definition.key,
      label: definition.label,
      sampleCount: sliceSamples.length,
      status: sliceSamples.length >= minimumCalibrationSamples ? "READY" : "COLLECTING",
      halfWidthKwh: sliceSamples.length >= minimumCalibrationSamples
        ? quantile90(sliceSamples.map((sample) => Math.abs(sample.estimatedEnergyKwh - sample.actualEnergyKwh)))
        : null,
      coverageTargetPct: 90,
    };
  });
  const evidenceQuality = combinedQuality(active);

  return {
    deduplicatedCount: deduplicated.length,
    excludedNightCount: deduplicated.length - active.length,
    evidenceQuality,
    overall,
    slices,
    calibration,
    promotion: promotionResult(active, slices, overall, evidenceQuality, timezone),
  };
}
