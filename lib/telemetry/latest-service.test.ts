import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ findReading: vi.fn(), findReadings: vi.fn(), findGateway: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({
  db: {
    telemetryReading: { findFirst: mocks.findReading, findMany: mocks.findReadings },
    edgeGateway: { findFirst: mocks.findGateway },
  },
}));

import { getLatestTelemetrySnapshot } from "@/lib/telemetry/latest-service";

const reading = {
  observedAt: new Date("2026-08-25T10:15:00.000Z"), source: "SIMULATOR", quality: "SIMULATED",
  pvPowerW: 2000, pvEnergyTodayWh: 9000, loadPowerW: 1200, gridPowerW: -800,
  batteryPowerW: 0, batterySocPct: 60, dcVoltageV: 380, dcCurrentA: 5,
  acVoltageV: 230, acCurrentA: 8, gridVoltageV: 230, frequencyHz: 50,
  inverterTemperatureC: 40, panelTemperatureC: 45, irradianceWm2: 500,
  deviceStatus: "NORMAL", gatewayId: null,
};

describe("latest telemetry service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findReading.mockResolvedValue(reading);
    mocks.findReadings.mockResolvedValue([reading]);
    mocks.findGateway.mockResolvedValue(null);
  });

  it("loads the site's complete local day from midnight through the latest observation", async () => {
    await getLatestTelemetrySnapshot(
      { id: "site-1", name: "Colombo Home", timezone: "Asia/Colombo" },
      new Date("2026-08-25T10:20:00.000Z"),
    );

    expect(mocks.findReadings).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        siteId: "site-1",
        observedAt: {
          gte: new Date("2026-08-24T18:30:00.000Z"),
          lte: reading.observedAt,
        },
      },
      orderBy: { observedAt: "asc" },
    }));
  });
});
