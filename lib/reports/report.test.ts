import { describe, expect, it } from "vitest";

import {
  buildReportSnapshot,
  reportPeriodRequestSchema,
  reportSnapshotToCsv,
  type ReportSnapshotInput,
} from "@/lib/reports/report";
import { reportSnapshotToPdf } from "@/lib/reports/report-pdf";

const input: ReportSnapshotInput = {
  generatedAt: new Date("2026-08-22T07:30:00.000Z"),
  site: {
    id: "site-1",
    name: "Colombo Home, West",
    timezone: "Asia/Colombo",
    mode: "SIMULATED",
  },
  period: {
    type: "WEEKLY",
    from: new Date("2026-08-10T00:00:00.000Z"),
    to: new Date("2026-08-17T00:00:00.000Z"),
  },
  history: {
    site: { id: "site-1", name: "Colombo Home, West", timezone: "Asia/Colombo" },
    range: { from: "2026-08-10T00:00:00.000Z", to: "2026-08-17T00:00:00.000Z", grain: "day" },
    points: [
      { bucketStart: "2026-08-10T00:00:00.000Z", label: "Aug 10", generationWh: 100_000, consumptionWh: 120_000, importWh: 40_000, exportWh: 20_000, batteryChargeWh: 14_000, batteryDischargeWh: 9_000, averageIrradianceWm2: 510, sampleCount: 288 },
    ],
    summary: { generationWh: 100_000, consumptionWh: 120_000, importWh: 40_000, exportWh: 20_000, selfConsumptionPct: 80 },
    comparison: { generationChangePct: 5, consumptionChangePct: -2 },
    completenessPct: 98.5,
  },
  performance: {
    site: { id: "site-1", name: "Colombo Home, West", timezone: "Asia/Colombo" },
    sourceLabel: "Simulated gateway data",
    range: { from: "2026-08-10T00:00:00.000Z", to: "2026-08-17T00:00:00.000Z", days: 7 },
    summary: { actualGenerationWh: 100_000, expectedGenerationWh: 112_000, performanceRatioPct: 89.3, estimatedLossWh: 12_000, availabilityPct: 97.2, configuredCapacityW: 6_160 },
    points: [],
    arrays: [],
  },
  incidents: [
    { severity: "CRITICAL", status: "RESOLVED", type: "GRID_OUTAGE", firstDetectedAt: new Date("2026-08-12T01:00:00.000Z"), lastDetectedAt: new Date("2026-08-12T01:25:00.000Z"), resolvedAt: new Date("2026-08-12T01:30:00.000Z") },
    { severity: "WARNING", status: "ACTIVE", type: "BATTERY_LOW", firstDetectedAt: new Date("2026-08-14T06:00:00.000Z"), lastDetectedAt: new Date("2026-08-14T06:15:00.000Z"), resolvedAt: null },
  ],
  verifications: [
    { errorKwh: -0.4, absoluteErrorKwh: 0.4, squaredErrorKwh2: 0.16, actualEnergyKwh: 2, actualQuality: "SIMULATED" },
    { errorKwh: 0.2, absoluteErrorKwh: 0.2, squaredErrorKwh2: 0.04, actualEnergyKwh: 1, actualQuality: "SIMULATED" },
  ],
};

describe("report snapshot contract", () => {
  it("reconciles energy, performance, alerts, forecast accuracy, and provenance", () => {
    const report = buildReportSnapshot(input);

    expect(report.schemaVersion).toBe("1.0");
    expect(report.energy).toMatchObject({
      generationKwh: 100,
      consumptionKwh: 120,
      selfConsumptionPct: 80,
      selfSufficiencyPct: 66.7,
      gridImportKwh: 40,
      gridExportKwh: 20,
      batteryChargeKwh: 14,
      batteryDischargeKwh: 9,
    });
    expect(report.performance).toMatchObject({ performanceRatioPct: 89.3, estimatedLossKwh: 12, availabilityPct: 97.2 });
    expect(report.forecastAccuracy).toMatchObject({ sampleCount: 2, maeKwh: 0.3, rmseKwh: 0.316, biasKwh: -0.1, wmapePct: 20, evidenceQuality: "SIMULATED" });
    expect(report.alerts).toMatchObject({ total: 2, critical: 1, warning: 1, resolved: 1, gridOutageMinutes: 30 });
    expect(report.environmentalEstimate).toEqual({ avoidedCo2eKg: 70, factorKgPerKwh: 0.7, isIllustrative: true });
  });

  it("exports a stable CSV with escaped metadata, summary metrics, and daily evidence", () => {
    const csv = reportSnapshotToCsv(buildReportSnapshot(input));

    expect(csv).toContain('site_name,"Colombo Home, West"');
    expect(csv).toContain("generation_kwh,100");
    expect(csv).toContain("date,generation_kwh,consumption_kwh");
    expect(csv).toContain("2026-08-10,100,120");
  });

  it("renders a downloadable PDF document from the immutable snapshot", async () => {
    const bytes = await reportSnapshotToPdf(buildReportSnapshot(input));

    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
    expect(bytes.byteLength).toBeGreaterThan(1_000);
  });

  it("validates complete weekly and calendar-month boundaries", () => {
    expect(reportPeriodRequestSchema.safeParse({ type: "WEEKLY", from: "2026-08-10", to: "2026-08-12" }).success).toBe(false);
    expect(reportPeriodRequestSchema.safeParse({ type: "MONTHLY", from: "2026-07-01", to: "2026-08-01" }).success).toBe(true);
    expect(reportPeriodRequestSchema.safeParse({ type: "MONTHLY", from: "2026-07-02", to: "2026-08-01" }).success).toBe(false);
  });

  it("withholds forecast metrics without labels and handles zero-consumption periods", () => {
    const report = buildReportSnapshot({
      ...input,
      history: { ...input.history, points: [], summary: { generationWh: 0, consumptionWh: 0, importWh: 0, exportWh: 0, selfConsumptionPct: 0 } },
      performance: { ...input.performance, summary: { ...input.performance.summary, performanceRatioPct: null } },
      verifications: [],
      incidents: [{ severity: "INFO", status: "ACTIVE", type: "GRID_OUTAGE", firstDetectedAt: new Date("2026-08-12T01:00:00Z"), lastDetectedAt: new Date("2026-08-12T01:15:00Z"), resolvedAt: null }],
    });

    expect(report.energy.selfSufficiencyPct).toBe(0);
    expect(report.forecastAccuracy).toMatchObject({ sampleCount: 0, maeKwh: null, evidenceQuality: "NO_EVIDENCE" });
    expect(report.alerts.gridOutageMinutes).toBe(15);
  });

  it("distinguishes measured from mixed forecast-verification evidence", () => {
    const measured = { errorKwh: 0.1, absoluteErrorKwh: 0.1, squaredErrorKwh2: 0.01, actualEnergyKwh: 0, actualQuality: "MEASURED" as const };
    expect(buildReportSnapshot({ ...input, verifications: [measured] }).forecastAccuracy).toMatchObject({ evidenceQuality: "MEASURED", wmapePct: null });
    expect(buildReportSnapshot({ ...input, verifications: [measured, input.verifications[0]] }).forecastAccuracy.evidenceQuality).toBe("MIXED");
  });

  it("renders the monthly and insufficient-performance PDF branches", async () => {
    const report = buildReportSnapshot({ ...input, period: { type: "MONTHLY", from: new Date("2026-07-01T00:00:00Z"), to: new Date("2026-08-01T00:00:00Z") }, performance: { ...input.performance, summary: { ...input.performance.summary, performanceRatioPct: null } } });
    await expect(reportSnapshotToPdf(report)).resolves.toHaveProperty("byteLength");
  });
});
