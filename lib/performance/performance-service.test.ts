import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findSite: vi.fn(),
  findReadings: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({
  db: {
    solarSite: { findFirst: mocks.findSite },
    telemetryReading: { findMany: mocks.findReadings },
  },
}));

import { getOwnedPerformanceReport } from "@/lib/performance/performance-service";

describe("performance service ownership boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findSite.mockResolvedValue({
      id: "site-1",
      name: "Colombo Home",
      timezone: "Asia/Colombo",
      mode: "SIMULATED",
      arrays: [{ id: "array-1", name: "East roof", panelCount: 7, ratedPowerW: 440 }],
      inverters: [{ acRatingW: 5_000, efficiencyPct: 96 }],
      gateways: [{ devices: [{ externalId: "array-east", name: "East roof", observations: [] }] }],
    });
    mocks.findReadings.mockResolvedValue([]);
  });

  it("selects the site by authenticated owner and scopes all evidence to that site", async () => {
    await getOwnedPerformanceReport("user-1", new Date("2026-08-01T00:00:00Z"), new Date("2026-08-31T00:00:00Z"));

    expect(mocks.findSite).toHaveBeenCalledWith(expect.objectContaining({ where: { ownerId: "user-1", deletedAt: null } }));
    expect(mocks.findReadings).toHaveBeenCalledWith(expect.objectContaining({ where: { siteId: "site-1", observedAt: { gte: expect.any(Date), lt: expect.any(Date) } } }));
  });

  it("returns null without querying telemetry when the owner has no site", async () => {
    mocks.findSite.mockResolvedValue(null);

    await expect(getOwnedPerformanceReport("user-without-site", new Date("2026-08-01T00:00:00Z"), new Date("2026-08-31T00:00:00Z"))).resolves.toBeNull();
    expect(mocks.findReadings).not.toHaveBeenCalled();
  });
});
