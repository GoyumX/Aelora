import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findSite: vi.fn(),
  findPoints: vi.fn(),
  findReadings: vi.fn(),
  createMany: vi.fn(),
  findVerifications: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({
  db: {
    solarSite: { findFirst: mocks.findSite },
    solarForecastPoint: { findMany: mocks.findPoints },
    telemetryReading: { findMany: mocks.findReadings },
    solarForecastVerification: {
      createMany: mocks.createMany,
      findMany: mocks.findVerifications,
    },
  },
}));

import {
  getSiteForecastEvaluation,
  refreshSiteForecastVerification,
} from "@/lib/forecast/verification-service";

const actor = { id: "user-1", role: "USER" as const };
const now = new Date("2026-08-21T07:00:00.000Z");

describe("forecast verification service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findSite.mockResolvedValue({
      id: "site-1",
      timezone: "Asia/Colombo",
      gateways: [{ expectedIntervalSec: 900 }],
    });
    mocks.findPoints.mockResolvedValue([{
      id: "point-1",
      validAt: new Date("2026-08-21T05:00:00.000Z"),
      leadHours: 24,
      estimatedEnergyKwh: 1.5,
      forecastRun: {
        issuedAt: new Date("2026-08-20T05:00:00.000Z"),
        artifactSha256: "a".repeat(64),
      },
    }]);
    mocks.findReadings.mockResolvedValue([
      { observedAt: new Date("2026-08-21T05:00:00.000Z"), pvPowerW: 1_000, quality: "SIMULATED" },
      { observedAt: new Date("2026-08-21T05:15:00.000Z"), pvPowerW: 1_000, quality: "SIMULATED" },
      { observedAt: new Date("2026-08-21T05:30:00.000Z"), pvPowerW: 1_000, quality: "SIMULATED" },
      { observedAt: new Date("2026-08-21T05:45:00.000Z"), pvPowerW: 1_000, quality: "SIMULATED" },
    ]);
    mocks.createMany.mockResolvedValue({ count: 1 });
  });

  it("joins only owner-scoped completed points and stores idempotent actual labels", async () => {
    const result = await refreshSiteForecastVerification(actor, "site-1", now);

    expect(mocks.findSite).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: "site-1", ownerId: "user-1", deletedAt: null }),
    }));
    expect(mocks.findPoints).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ validAt: { lte: new Date("2026-08-21T06:00:00.000Z") }, verification: null }),
    }));
    expect(mocks.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({
        solarForecastPointId: "point-1",
        actualEnergyKwh: 1,
        errorKwh: 0.5,
        absoluteErrorKwh: 0.5,
        coveragePct: 100,
        actualQuality: "SIMULATED",
      })],
      skipDuplicates: true,
    });
    expect(result).toEqual({ considered: 1, persisted: 1, withheld: 0 });
  });

  it("returns an owner-scoped evaluation DTO without raw telemetry", async () => {
    mocks.findVerifications.mockResolvedValue([{
      id: "verification-1",
      actualEnergyKwh: 1,
      actualQuality: "SIMULATED",
      verifiedAt: now,
      point: {
        id: "point-1",
        validAt: new Date("2026-08-21T05:00:00.000Z"),
        leadHours: 24,
        estimatedEnergyKwh: 1.5,
        forecastRun: {
          issuedAt: new Date("2026-08-20T05:00:00.000Z"),
          artifactSha256: "a".repeat(64),
        },
      },
    }]);

    const result = await getSiteForecastEvaluation(actor, "site-1");

    expect(result).toMatchObject({
      siteId: "site-1",
      evidenceQuality: "SIMULATED",
      overall: { sampleCount: 1, maeKwh: 0.5, rmseKwh: 0.5, wMapePct: 50 },
      promotion: { status: "BLOCKED_SIMULATED_EVIDENCE" },
    });
    expect(result).not.toHaveProperty("readings");
  });

  it("hides another user's site before reading forecast or telemetry evidence", async () => {
    mocks.findSite.mockResolvedValue(null);

    await expect(refreshSiteForecastVerification(actor, "site-2", now)).rejects.toMatchObject({ code: "site_not_found" });
    expect(mocks.findPoints).not.toHaveBeenCalled();
    expect(mocks.findReadings).not.toHaveBeenCalled();
  });
});
