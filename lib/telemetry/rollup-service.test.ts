import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findSite: vi.fn(),
  findSites: vi.fn(),
  findReadings: vi.fn(),
  findStoredIntervals: vi.fn(),
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
    mocks.transaction.mockImplementation(async (callback) => callback({
      telemetryRollup15Minute: { upsert: mocks.upsertInterval },
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
