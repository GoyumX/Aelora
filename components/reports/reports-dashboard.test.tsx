import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));

import { ReportsDashboard } from "@/components/reports/reports-dashboard";
import type { ReportsView } from "@/lib/reports/report-service";

const view: ReportsView = {
  site: { id: "site-1", name: "Colombo Home", timezone: "Asia/Colombo", mode: "SIMULATED" },
  suggestedPeriods: [
    { type: "WEEKLY", from: "2026-08-10", to: "2026-08-17", label: "Aug 10–16, 2026" },
    { type: "MONTHLY", from: "2026-07-01", to: "2026-08-01", label: "July 2026" },
  ],
  reports: [{
    id: "report-1", type: "WEEKLY", generatedAt: "2026-08-22T07:30:00.000Z", dataHash: "a".repeat(64),
    payload: {
      schemaVersion: "1.0", generatedAt: "2026-08-22T07:30:00.000Z",
      site: { id: "site-1", name: "Colombo Home", timezone: "Asia/Colombo", mode: "SIMULATED" },
      period: { type: "WEEKLY", from: "2026-08-10T00:00:00.000Z", to: "2026-08-17T00:00:00.000Z", label: "Aug 10–16, 2026" },
      provenance: { sourceLabel: "Simulated gateway data", completenessPct: 98.5, dataCutoffAt: "2026-08-17T00:00:00.000Z" },
      energy: { generationKwh: 100, consumptionKwh: 120, selfConsumptionPct: 80, selfSufficiencyPct: 66.7, gridImportKwh: 40, gridExportKwh: 20, batteryChargeKwh: 14, batteryDischargeKwh: 9 },
      performance: { expectedGenerationKwh: 112, performanceRatioPct: 89.3, estimatedLossKwh: 12, availabilityPct: 97.2, configuredCapacityKwp: 6.16 },
      forecastAccuracy: { sampleCount: 2, maeKwh: 0.3, rmseKwh: 0.316, biasKwh: -0.1, wmapePct: 20, evidenceQuality: "SIMULATED" },
      alerts: { total: 2, critical: 1, warning: 1, resolved: 1, gridOutageMinutes: 30 },
      environmentalEstimate: { avoidedCo2eKg: 70, factorKgPerKwh: 0.7, isIllustrative: true },
      daily: [],
    },
  }],
};

describe("ReportsDashboard", () => {
  beforeEach(() => { vi.clearAllMocks(); vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true })); });

  it("shows weekly/monthly generation, immutable history, evidence, and both downloads", () => {
    render(<ReportsDashboard view={view} />);

    expect(screen.getByRole("heading", { name: "Reports" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /generate weekly report/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /generate monthly report/i })).toBeInTheDocument();
    expect(screen.getByText("100.0 kWh")).toBeInTheDocument();
    expect(screen.getByText("Simulated gateway data")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /download csv/i })).toHaveAttribute("href", "/api/sites/site-1/reports/report-1/csv");
    expect(screen.getByRole("link", { name: /download pdf/i })).toHaveAttribute("href", "/api/sites/site-1/reports/report-1/pdf");
    expect(screen.getByText(/immutable snapshot/i)).toBeInTheDocument();
  });

  it("generates a selected report and refreshes the server-rendered list", async () => {
    const user = userEvent.setup();
    render(<ReportsDashboard view={{ ...view, reports: [] }} />);

    await user.click(screen.getByRole("button", { name: /generate weekly report/i }));

    expect(fetch).toHaveBeenCalledWith("/api/sites/site-1/reports", expect.objectContaining({ method: "POST" }));
    expect(mocks.refresh).toHaveBeenCalled();
  });

  it("keeps the empty state and reports generation failures", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: false } as Response);
    const user = userEvent.setup();
    render(<ReportsDashboard view={{ ...view, site: { ...view.site, mode: "HARDWARE" }, reports: [] }} />);

    expect(screen.getByRole("heading", { name: "No report snapshots yet" })).toBeInTheDocument();
    expect(screen.getByText("Measured site")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /generate monthly report/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Report generation failed.");
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it("shows withheld forecast and performance evidence honestly", () => {
    const payload = { ...view.reports[0].payload, performance: { ...view.reports[0].payload.performance, performanceRatioPct: null }, forecastAccuracy: { ...view.reports[0].payload.forecastAccuracy, sampleCount: 0, maeKwh: null, evidenceQuality: "NO_EVIDENCE" as const } };
    render(<ReportsDashboard view={{ ...view, reports: [{ ...view.reports[0], payload }] }} />);
    expect(screen.getByText("Insufficient evidence")).toBeInTheDocument();
    expect(screen.getByText("Collecting evidence")).toBeInTheDocument();
  });
});
