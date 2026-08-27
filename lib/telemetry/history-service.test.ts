import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findDaily: vi.fn(),
  findReadings: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({
  db: {
    telemetryRollupDaily: { findMany: mocks.findDaily },
    telemetryReading: { findMany: mocks.findReadings },
  },
}));

import { getHistoricalTelemetry } from "@/lib/telemetry/history-service";

const from = new Date("2026-08-01T18:30:00.000Z");
const to = new Date("2026-08-31T18:30:00.000Z");
const daily = {
  localDate: new Date("2026-08-02T00:00:00.000Z"),
  dayStartAt: new Date("2026-08-01T18:30:00.000Z"),
  dayEndAt: new Date("2026-08-02T18:30:00.000Z"),
  generationWh: 12_000,
  consumptionWh: 10_000,
  importWh: 2_000,
  exportWh: 4_000,
  batteryChargeWh: 500,
  batteryDischargeWh: 300,
  averageIrradianceWm2: 450,
  sampleCount: 2_880,
  coveredDurationSec: 86_400,
};

describe("historical analytics roll-up cutover", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses daily roll-ups for long-range analytics without loading raw telemetry", async () => {
    mocks.findDaily.mockResolvedValueOnce([daily]).mockResolvedValueOnce([{ ...daily, generationWh: 10_000 }]);

    await expect(getHistoricalTelemetry({ id: "site-rollup", name: "Colombo Home", timezone: "Asia/Colombo" }, from, to, "day")).resolves.toMatchObject({
      points: [expect.objectContaining({ generationWh: 12_000, consumptionWh: 10_000 })],
      summary: expect.objectContaining({ generationWh: 12_000 }),
      comparison: { generationChangePct: 20, consumptionChangePct: 0 },
      dataResolution: "DAILY_ROLLUP",
    });
    expect(mocks.findReadings).not.toHaveBeenCalled();
  });

  it("falls back to raw readings when a requested range has no daily summaries", async () => {
    mocks.findDaily.mockResolvedValue([]);
    mocks.findReadings.mockResolvedValue([]);

    await expect(getHistoricalTelemetry({ id: "site-raw", name: "New Site", timezone: "Asia/Colombo" }, from, to, "day")).resolves.toMatchObject({
      points: [],
      dataResolution: "RAW_TELEMETRY",
    });
    expect(mocks.findReadings).toHaveBeenCalledTimes(2);
  });
});
