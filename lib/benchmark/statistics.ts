export type SampleSummary = {
  count: number;
  min: number;
  max: number;
  mean: number;
  p50: number;
  p95: number;
  p99: number;
  budget: number;
  passed: boolean;
};

function round(value: number) {
  return Math.round(value * 100) / 100;
}

function validateSamples(samples: readonly number[]) {
  if (samples.length === 0) {
    throw new Error("Performance statistics require at least one sample.");
  }

  if (samples.some((sample) => !Number.isFinite(sample))) {
    throw new Error("Performance statistics require finite samples.");
  }
}

export function nearestRankPercentile(samples: readonly number[], percentile: number) {
  validateSamples(samples);

  if (percentile <= 0 || percentile > 1) {
    throw new Error("Percentile must be between 0 and 1.");
  }

  const sorted = [...samples].sort((left, right) => left - right);
  const rank = Math.ceil(percentile * sorted.length);

  return sorted[Math.max(0, rank - 1)];
}

export function summarizeSamples(samples: readonly number[], budget: number): SampleSummary {
  validateSamples(samples);

  if (!Number.isFinite(budget) || budget <= 0) {
    throw new Error("Performance budget must be a positive finite number.");
  }

  const minimum = Math.min(...samples);
  const maximum = Math.max(...samples);
  const mean = samples.reduce((total, sample) => total + sample, 0) / samples.length;
  const p95 = nearestRankPercentile(samples, 0.95);

  return {
    count: samples.length,
    min: round(minimum),
    max: round(maximum),
    mean: round(mean),
    p50: round(nearestRankPercentile(samples, 0.5)),
    p95: round(p95),
    p99: round(nearestRankPercentile(samples, 0.99)),
    budget,
    passed: p95 <= budget,
  };
}
