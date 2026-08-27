import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getCurrentUser: vi.fn(), getReport: vi.fn(), toPdf: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/lib/reports/report-pdf", () => ({ reportSnapshotToPdf: mocks.toPdf }));
vi.mock("@/lib/reports/report-service", () => ({
  getReportSnapshot: mocks.getReport,
  ReportDomainError: class ReportDomainError extends Error { constructor(public code: string) { super(code); } },
}));

import { GET } from "@/app/api/sites/[siteId]/reports/[reportId]/[format]/route";

const payload = {
  schemaVersion: "1.0", generatedAt: "2026-08-22T07:30:00.000Z",
  site: { id: "site-1", name: "Colombo Home", timezone: "Asia/Colombo", mode: "SIMULATED" },
  period: { type: "WEEKLY", from: "2026-08-10T00:00:00.000Z", to: "2026-08-17T00:00:00.000Z", label: "Aug 10–16, 2026" },
  provenance: { sourceLabel: "Simulated gateway data", completenessPct: 100, dataCutoffAt: "2026-08-17T00:00:00.000Z" },
  energy: { generationKwh: 10, consumptionKwh: 12, selfConsumptionPct: 80, selfSufficiencyPct: 66.7, gridImportKwh: 4, gridExportKwh: 2, batteryChargeKwh: 1, batteryDischargeKwh: 1 },
  performance: { expectedGenerationKwh: 11, performanceRatioPct: 90.9, estimatedLossKwh: 1, availabilityPct: 100, configuredCapacityKwp: 6.16 },
  forecastAccuracy: { sampleCount: 0, maeKwh: null, rmseKwh: null, biasKwh: null, wmapePct: null, evidenceQuality: "NO_EVIDENCE" },
  alerts: { total: 0, critical: 0, warning: 0, resolved: 0, gridOutageMinutes: 0 },
  environmentalEstimate: { avoidedCo2eKg: 7, factorKgPerKwh: 0.7, isIllustrative: true }, daily: [],
} as const;

describe("report download route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentUser.mockResolvedValue({ id: "user-1", role: "USER" });
    mocks.getReport.mockResolvedValue({ id: "report-1", type: "WEEKLY", generatedAt: payload.generatedAt, dataHash: "abc", payload });
    mocks.toPdf.mockResolvedValue(new TextEncoder().encode("%PDF-report"));
  });

  it("returns an attachment CSV from the authorized immutable snapshot", async () => {
    const response = await GET(new Request("http://localhost"), { params: Promise.resolve({ siteId: "site-1", reportId: "report-1", format: "csv" }) });
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/csv");
    expect(response.headers.get("content-disposition")).toContain("aelora-weekly-2026-08-10.csv");
    expect(await response.text()).toContain("generation_kwh,10,kWh");
  });

  it("returns a PDF attachment and rejects unsupported formats", async () => {
    const pdf = await GET(new Request("http://localhost"), { params: Promise.resolve({ siteId: "site-1", reportId: "report-1", format: "pdf" }) });
    expect(pdf.headers.get("content-type")).toBe("application/pdf");
    expect(new TextDecoder().decode(await pdf.arrayBuffer())).toBe("%PDF-report");

    const invalid = await GET(new Request("http://localhost"), { params: Promise.resolve({ siteId: "site-1", reportId: "report-1", format: "docx" }) });
    expect(invalid.status).toBe(404);
  });

  it("requires authentication before loading a report", async () => {
    mocks.getCurrentUser.mockResolvedValue(null);
    const response = await GET(new Request("http://localhost"), { params: Promise.resolve({ siteId: "site-1", reportId: "report-1", format: "csv" }) });
    expect(response.status).toBe(401);
    expect(mocks.getReport).not.toHaveBeenCalled();
  });
});
