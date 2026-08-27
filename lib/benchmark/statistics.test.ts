import { describe, expect, it } from "vitest";

import { nearestRankPercentile, summarizeSamples } from "@/lib/benchmark/statistics";

describe("nearestRankPercentile", () => {
  it("sorts the samples without mutating the input and uses nearest-rank percentiles", () => {
    const samples = [50, 10, 40, 20, 30];

    expect(nearestRankPercentile(samples, 0.5)).toBe(30);
    expect(nearestRankPercentile(samples, 0.95)).toBe(50);
    expect(samples).toEqual([50, 10, 40, 20, 30]);
  });

  it("rejects empty, non-finite, or invalid percentile inputs", () => {
    expect(() => nearestRankPercentile([], 0.5)).toThrow("at least one sample");
    expect(() => nearestRankPercentile([1, Number.NaN], 0.5)).toThrow("finite");
    expect(() => nearestRankPercentile([1], 0)).toThrow("between 0 and 1");
    expect(() => nearestRankPercentile([1], 1.1)).toThrow("between 0 and 1");
  });
});

describe("summarizeSamples", () => {
  it("produces stable latency statistics and evaluates the p95 budget", () => {
    expect(summarizeSamples([10, 20, 30, 40], 35)).toEqual({
      count: 4,
      min: 10,
      max: 40,
      mean: 25,
      p50: 20,
      p95: 40,
      p99: 40,
      budget: 35,
      passed: false,
    });
  });

  it("rounds noisy measurements to two decimal places", () => {
    expect(summarizeSamples([1.111, 2.222, 3.333], 4)).toMatchObject({
      mean: 2.22,
      p50: 2.22,
      p95: 3.33,
      passed: true,
    });
  });
});
