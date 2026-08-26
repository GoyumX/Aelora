import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findSite: vi.fn(),
  findSites: vi.fn(),
  findReadings: vi.fn(),
  findStoredIntervals: vi.fn(),
  findDayIntervals: vi.fn(),
  upsertInterval: vi.fn(),
  upsertDay: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({
  db: {
    solarSite: { findUnique: mocks.findSite, findMany: mocks.findSites },
    telemetryReading: { findMany: mocks.findReadings },
    telemetryRollup15Minute: { findMany: mocks.findStoredIntervals },
    $transaction: mocks.transaction,
  },
}));

import { reconcileSiteRollups, rollupSiteRange, runIncrementalTelemetryRollups } from "@/lib/telemetry/rollup-service";

const from = new Date("2026-08-01T18:30:00.000Z");
const to = new Date("2026-08-02T18:30:00.000Z");
const rawReadings = [
  { observedAt: new Date("2026-08-01T18:30:00.000Z"), pvPowerW: 1_000, loadPowerW: 800, gridPowerW: -200, batteryPowerW: 0, irradianceWm2: 500, quality: "SIMULATED" },
  { observedAt: new Date("2026-08-01T18:30:30.000Z"), pvPowerW: 1_000, loadPowerW: 800, gridPowerW: -200, batteryPowerW: 0, irradianceWm2: 500, quality: "SIMULATED" },
] as const;

describe("telemetry roll-up persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findSite.mockResolvedValue({
      id: "site-1",
      timezone: "Asia/Colombo",
      gateways: [{ expectedIntervalSec: 30 }],
    });
    mocks.findReadings.mockResolvedValue(rawReadings);
    mocks.upsertInterval.mockResolvedValue({ id: "interval-1" });
    mocks.upsertDay.mockResolvedValue({ id: "day-1" });
    mocks.findDayIntervals.mockResolvedValue([]);
    mocks.transaction.mockImplementation(async (callback) => callback({
      telemetryRollup15Minute: { upsert: mocks.upsertInterval, findMany: mocks.findDayIntervals },
      telemetryRollupDaily: { upsert: mocks.upsertDay },
    }));
  });

  it("upserts deterministic 15-minute and local-day rows in one transaction", async () => {
    await expect(rollupSiteRange("site-1", from, to)).resolves.toMatchObject({
      siteId: "site-1",
      intervalCount: 1,
      dailyCount: 1,
      rawReadingCount: 2,
    });

    expect(mocks.findReadings).toHaveBeenCalledWith(expect.objectContaining({
      where: { siteId: "site-1", observedAt: { gte: from, lt: to } },
      orderBy: { observedAt: "asc" },
    }));
    expect(mocks.upsertInterval).toHaveBeenCalledWith(expect.objectContaining({
      where: { siteId_bucketStart: { siteId: "site-1", bucketStart: from } },
      create: expect.objectContaining({ siteId: "site-1", generationWh: 17, expectedIntervalSec: 30 }),
      update: expect.objectContaining({ generationWh: 17, expectedIntervalSec: 30 }),
    }));
    expect(mocks.upsertDay).toHaveBeenCalledWith(expect.objectContaining({
      where: { siteId_localDate: { siteId: "site-1", localDate: new Date("2026-08-02T00:00:00.000Z") } },
      create: expect.objectContaining({ siteId: "site-1", timezone: "Asia/Colombo", generationWh: 17 }),
    }));
    expect(mocks.transaction).toHaveBeenCalledTimes(1);
  });

  it("fails closed for an unknown site without reading or writing telemetry", async () => {
    mocks.findSite.mockResolvedValue(null);

    await expect(rollupSiteRange("missing", from, to)).rejects.toThrow("Solar site was not found");
    expect(mocks.findReadings).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("rebuilds a local day from every stored interval instead of overwriting it with the latest window", async () => {
    const earlier = {
      bucketStart: new Date("2026-08-01T18:30:00.000Z"), bucketEnd: new Date("2026-08-01T18:45:00.000Z"),
      generationWh: 100, consumptionWh: 120, importWh: 30, exportWh: 10, batteryChargeWh: 5, batteryDischargeWh: 2,
      averagePvPowerW: 400, peakPvPowerW: 500, averageLoadPowerW: 480, peakLoadPowerW: 600, averageIrradianceWm2: 450,
      sampleCount: 30, expectedSampleCount: 30, expectedIntervalSec: 30, coveredDurationSec: 900, coveragePct: 100, maxGapSec: 30,
      evidenceQuality: "SIMULATED", firstObservedAt: new Date("2026-08-01T18:30:00.000Z"), lastObservedAt: new Date("2026-08-01T18:44:30.000Z"),
    };
    mocks.findDayIntervals.mockResolvedValue([earlier, { ...earlier, bucketStart: new Date("2026-08-01T18:45:00.000Z"), bucketEnd: new Date("2026-08-01T19:00:00.000Z"), generationWh: 150 }]);

    await rollupSiteRange("site-1", from, to);

    expect(mocks.findDayIntervals).toHaveBeenCalledWith(expect.objectContaining({
      where: { siteId: "site-1", bucketStart: { gte: new Date("2026-08-01T18:30:00.000Z"), lt: new Date("2026-08-02T18:30:00.000Z") } },
    }));
    expect(mocks.upsertDay).toHaveBeenCalledWith(expect.objectContaining({ create: expect.objectContaining({ generationWh: 250 }) }));
  });

  it("reconciles stored intervals against a fresh raw calculation", async () => {
    mocks.findStoredIntervals.mockResolvedValue([{
      generationWh: 17,
      consumptionWh: 13,
      importWh: 0,
      exportWh: 3,
      batteryChargeWh: 0,
      batteryDischargeWh: 0,
      coveredDurationSec: 60,
    }]);

    await expect(reconcileSiteRollups("site-1", from, to)).resolves.toMatchObject({
      passed: true,
      expectedIntervalCount: 1,
      storedIntervalCount: 1,
      differences: [],
    });
  });

  it("runs every active site independently so one failure does not stop the scheduler", async () => {
    mocks.findSites.mockResolvedValue([{ id: "site-1" }, { id: "missing" }]);
    mocks.findSite.mockResolvedValueOnce({ id: "site-1", timezone: "Asia/Colombo", gateways: [{ expectedIntervalSec: 30 }] }).mockResolvedValueOnce(null);
    mocks.findReadings.mockResolvedValue([]);

    await expect(runIncrementalTelemetryRollups(new Date("2026-08-26T06:30:00.000Z"))).resolves.toMatchObject({
      attempted: 2,
      completed: 1,
      failed: 1,
      results: [expect.objectContaining({ siteId: "site-1", status: "COMPLETED" }), expect.objectContaining({ siteId: "missing", status: "FAILED" })],
    });
  });
});
