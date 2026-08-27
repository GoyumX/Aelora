import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findSite: vi.fn(),
  findReports: vi.fn(),
  findReport: vi.fn(),
  upsertReport: vi.fn(),
  findIncidents: vi.fn(),
  findVerifications: vi.fn(),
  getHistory: vi.fn(),
  getPerformance: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({
  db: {
    solarSite: { findFirst: mocks.findSite },
    reportSnapshot: { findMany: mocks.findReports, findFirst: mocks.findReport, upsert: mocks.upsertReport },
    alertIncident: { findMany: mocks.findIncidents },
    solarForecastVerification: { findMany: mocks.findVerifications },
  },
}));
vi.mock("@/lib/telemetry/history-service", () => ({ getHistoricalTelemetry: mocks.getHistory }));
vi.mock("@/lib/performance/performance-service", () => ({ getSitePerformanceReport: mocks.getPerformance }));

import { generateReportSnapshot, getReportSnapshot, getReportsView, ReportDomainError } from "@/lib/reports/report-service";

const site = { id: "site-1", ownerId: "user-1", name: "Colombo Home", timezone: "Asia/Colombo", mode: "SIMULATED" };
const period = { type: "WEEKLY" as const, from: "2026-08-10", to: "2026-08-17" };

describe("report service ownership and persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findSite.mockResolvedValue(site);
    mocks.findReports.mockResolvedValue([]);
    mocks.findReport.mockResolvedValue(null);
    mocks.findIncidents.mockResolvedValue([]);
    mocks.findVerifications.mockResolvedValue([]);
    mocks.getHistory.mockResolvedValue({
      site: { id: site.id, name: site.name, timezone: site.timezone },
      range: { from: "2026-08-10T00:00:00.000Z", to: "2026-08-17T00:00:00.000Z", grain: "day" },
      points: [], summary: { generationWh: 0, consumptionWh: 0, importWh: 0, exportWh: 0, selfConsumptionPct: 0 },
      comparison: { generationChangePct: null, consumptionChangePct: null }, completenessPct: 0,
    });
    mocks.getPerformance.mockResolvedValue({
      site: { id: site.id, name: site.name, timezone: site.timezone }, sourceLabel: "Simulated gateway data",
      range: { from: "2026-08-10T00:00:00.000Z", to: "2026-08-17T00:00:00.000Z", days: 7 },
      summary: { actualGenerationWh: 0, expectedGenerationWh: 0, performanceRatioPct: null, estimatedLossWh: 0, availabilityPct: 0, configuredCapacityW: 0 }, points: [], arrays: [],
    });
    mocks.upsertReport.mockImplementation(async ({ create }) => ({ id: "report-1", ...create }));
  });

  it("creates one immutable, content-addressed snapshot from site-scoped evidence", async () => {
    const report = await generateReportSnapshot({ id: "user-1", role: "USER" }, "site-1", period, new Date("2026-08-22T07:30:00Z"));

    expect(mocks.findSite).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: "site-1" }) }));
    expect(mocks.getHistory).toHaveBeenCalledWith(expect.objectContaining({ id: "site-1" }), new Date("2026-08-09T18:30:00.000Z"), new Date("2026-08-16T18:30:00.000Z"), "day");
    expect(mocks.findIncidents).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ siteId: "site-1" }) }));
    expect(mocks.upsertReport).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ siteId: "site-1", type: "WEEKLY", schemaVersion: "1.0", dataHash: expect.stringMatching(/^[a-f0-9]{64}$/) }),
      update: {},
    }));
    expect(report.id).toBe("report-1");
  });

  it("hides another user's site while allowing an administrator", async () => {
    await expect(generateReportSnapshot({ id: "user-2", role: "USER" }, "site-1", period)).rejects.toEqual(expect.objectContaining<Partial<ReportDomainError>>({ code: "SITE_NOT_FOUND" }));
    expect(mocks.upsertReport).not.toHaveBeenCalled();

    await expect(generateReportSnapshot({ id: "admin-1", role: "ADMIN" }, "site-1", period)).resolves.toMatchObject({ id: "report-1" });
  });

  it("lists existing snapshots and proposes the last completed week and month", async () => {
    await generateReportSnapshot({ id: "user-1", role: "USER" }, "site-1", period, new Date("2026-08-22T07:30:00Z"));
    const created = mocks.upsertReport.mock.calls[0][0].create;
    mocks.findReports.mockResolvedValue([{ id: "report-1", type: created.type, generatedAt: created.generatedAt, dataHash: created.dataHash, payload: created.payload }]);

    const view = await getReportsView({ id: "user-1", role: "USER" }, "site-1", new Date("2026-08-22T07:30:00Z"));

    expect(view.suggestedPeriods).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "WEEKLY", from: "2026-08-10", to: "2026-08-17" }),
      expect.objectContaining({ type: "MONTHLY", from: "2026-07-01", to: "2026-08-01" }),
    ]));
    expect(view.reports).toHaveLength(1);
  });

  it("rejects invalid periods before loading a site", async () => {
    await expect(generateReportSnapshot({ id: "user-1", role: "USER" }, "site-1", { type: "WEEKLY", from: "2026-08-10", to: "2026-08-12" })).rejects.toEqual(expect.objectContaining<Partial<ReportDomainError>>({ code: "INVALID_PERIOD" }));
    expect(mocks.findSite).not.toHaveBeenCalled();
  });

  it("loads an authorized snapshot and returns a not-found boundary", async () => {
    await generateReportSnapshot({ id: "user-1", role: "USER" }, "site-1", period, new Date("2026-08-22T07:30:00Z"));
    const created = mocks.upsertReport.mock.calls[0][0].create;
    mocks.findReport.mockResolvedValueOnce({ id: "report-1", type: created.type, generatedAt: created.generatedAt, dataHash: created.dataHash, payload: created.payload });

    await expect(getReportSnapshot({ id: "user-1", role: "USER" }, "site-1", "report-1")).resolves.toMatchObject({ id: "report-1" });
    await expect(getReportSnapshot({ id: "user-1", role: "USER" }, "site-1", "missing")).rejects.toEqual(expect.objectContaining<Partial<ReportDomainError>>({ code: "REPORT_NOT_FOUND" }));
  });

  it("rejects corrupt stored snapshot JSON", async () => {
    mocks.findReports.mockResolvedValue([{ id: "bad", type: "WEEKLY", generatedAt: new Date(), dataHash: "bad", payload: { schemaVersion: "0" } }]);
    await expect(getReportsView({ id: "user-1", role: "USER" }, "site-1")).rejects.toEqual(expect.objectContaining<Partial<ReportDomainError>>({ code: "CORRUPT_REPORT" }));
  });
});
