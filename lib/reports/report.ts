import { z } from "zod";

import type { AlertSeverity, AlertStatus, AlertType, ForecastActualQuality, SiteMode } from "@prisma/client";

import type { PerformanceReport } from "@/lib/performance/performance";
import type { HistoricalTelemetry } from "@/lib/telemetry/history";

const DAY_MS = 86_400_000;
export const reportTypes = ["WEEKLY", "MONTHLY"] as const;
export type ReportType = (typeof reportTypes)[number];

export const reportPeriodRequestSchema = z.object({
  type: z.enum(reportTypes),
  from: z.iso.date(),
  to: z.iso.date(),
}).superRefine((value, context) => {
  const from = new Date(`${value.from}T00:00:00.000Z`);
  const to = new Date(`${value.to}T00:00:00.000Z`);
  const days = (to.getTime() - from.getTime()) / DAY_MS;
  if (value.type === "WEEKLY" && days !== 7) {
    context.addIssue({ code: "custom", path: ["to"], message: "A weekly report must cover exactly seven calendar days." });
  }
  if (value.type === "MONTHLY") {
    const expectedTo = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 1, 1));
    if (from.getUTCDate() !== 1 || expectedTo.getTime() !== to.getTime()) {
      context.addIssue({ code: "custom", path: ["to"], message: "A monthly report must cover one complete calendar month." });
    }
  }
});

export type ReportIncident = {
  severity: AlertSeverity;
  status: AlertStatus;
  type: AlertType;
  firstDetectedAt: Date;
  lastDetectedAt: Date;
  resolvedAt: Date | null;
};

export type ReportVerification = {
  errorKwh: number;
  absoluteErrorKwh: number;
  squaredErrorKwh2: number;
  actualEnergyKwh: number;
  actualQuality: ForecastActualQuality;
};

export type ReportSnapshotInput = {
  generatedAt: Date;
  site: { id: string; name: string; timezone: string; mode: SiteMode };
  period: { type: ReportType; from: Date; to: Date };
  history: HistoricalTelemetry;
  performance: PerformanceReport;
  incidents: ReportIncident[];
  verifications: ReportVerification[];
};

const nullableNumber = z.number().finite().nullable();

export const reportSnapshotSchema = z.object({
  schemaVersion: z.literal("1.0"),
  generatedAt: z.iso.datetime(),
  site: z.object({ id: z.string(), name: z.string(), timezone: z.string(), mode: z.enum(["SIMULATED", "HARDWARE"]) }),
  period: z.object({ type: z.enum(reportTypes), from: z.iso.datetime(), to: z.iso.datetime(), label: z.string() }),
  provenance: z.object({ sourceLabel: z.string(), completenessPct: z.number().finite(), dataCutoffAt: z.iso.datetime() }),
  energy: z.object({
    generationKwh: z.number().finite(), consumptionKwh: z.number().finite(), selfConsumptionPct: z.number().finite(),
    selfSufficiencyPct: z.number().finite(), gridImportKwh: z.number().finite(), gridExportKwh: z.number().finite(),
    batteryChargeKwh: z.number().finite(), batteryDischargeKwh: z.number().finite(),
  }),
  performance: z.object({
    expectedGenerationKwh: z.number().finite(), performanceRatioPct: nullableNumber, estimatedLossKwh: z.number().finite(),
    availabilityPct: z.number().finite(), configuredCapacityKwp: z.number().finite(),
  }),
  forecastAccuracy: z.object({
    sampleCount: z.number().int().nonnegative(), maeKwh: nullableNumber, rmseKwh: nullableNumber, biasKwh: nullableNumber,
    wmapePct: nullableNumber, evidenceQuality: z.enum(["SIMULATED", "MEASURED", "MIXED", "NO_EVIDENCE"]),
  }),
  alerts: z.object({ total: z.number().int().nonnegative(), critical: z.number().int().nonnegative(), warning: z.number().int().nonnegative(), resolved: z.number().int().nonnegative(), gridOutageMinutes: z.number().nonnegative() }),
  environmentalEstimate: z.object({ avoidedCo2eKg: z.number().nonnegative(), factorKgPerKwh: z.number().positive(), isIllustrative: z.boolean() }),
  daily: z.array(z.object({ date: z.string(), label: z.string(), generationKwh: z.number(), consumptionKwh: z.number(), gridImportKwh: z.number(), gridExportKwh: z.number(), batteryChargeKwh: z.number(), batteryDischargeKwh: z.number(), averageIrradianceWm2: z.number(), sampleCount: z.number().int().nonnegative() })),
});

export type ReportSnapshot = z.infer<typeof reportSnapshotSchema>;

function round(value: number, places = 1) {
  const factor = 10 ** places;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function periodLabel(type: ReportType, from: Date, to: Date, timezone: string) {
  if (type === "MONTHLY") return new Intl.DateTimeFormat("en", { month: "long", year: "numeric", timeZone: timezone }).format(from);
  const finalDay = new Date(to.getTime() - 1);
  const start = new Intl.DateTimeFormat("en", { month: "short", day: "numeric", timeZone: timezone }).format(from);
  const end = new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric", timeZone: timezone }).format(finalDay);
  return `${start}–${end}`;
}

function forecastAccuracy(verifications: ReportVerification[]): ReportSnapshot["forecastAccuracy"] {
  if (!verifications.length) return { sampleCount: 0, maeKwh: null, rmseKwh: null, biasKwh: null, wmapePct: null, evidenceQuality: "NO_EVIDENCE" };
  const totalActual = verifications.reduce((sum, item) => sum + Math.abs(item.actualEnergyKwh), 0);
  const evidence = new Set(verifications.map((item) => item.actualQuality));
  const evidenceQuality = evidence.size === 1 && evidence.has("SIMULATED") ? "SIMULATED"
    : evidence.size === 1 && evidence.has("MEASURED") ? "MEASURED" : "MIXED";
  return {
    sampleCount: verifications.length,
    maeKwh: round(verifications.reduce((sum, item) => sum + item.absoluteErrorKwh, 0) / verifications.length, 3),
    rmseKwh: round(Math.sqrt(verifications.reduce((sum, item) => sum + item.squaredErrorKwh2, 0) / verifications.length), 3),
    biasKwh: round(verifications.reduce((sum, item) => sum + item.errorKwh, 0) / verifications.length, 3),
    wmapePct: totalActual ? round(verifications.reduce((sum, item) => sum + item.absoluteErrorKwh, 0) / totalActual * 100, 1) : null,
    evidenceQuality,
  };
}

function alertSummary(incidents: ReportIncident[], from: Date, to: Date): ReportSnapshot["alerts"] {
  const gridOutageMs = incidents.filter((incident) => incident.type === "GRID_OUTAGE").reduce((total, incident) => {
    const start = Math.max(from.getTime(), incident.firstDetectedAt.getTime());
    const end = Math.min(to.getTime(), (incident.resolvedAt ?? incident.lastDetectedAt).getTime());
    return total + Math.max(0, end - start);
  }, 0);
  return {
    total: incidents.length,
    critical: incidents.filter((incident) => incident.severity === "CRITICAL").length,
    warning: incidents.filter((incident) => incident.severity === "WARNING").length,
    resolved: incidents.filter((incident) => incident.status === "RESOLVED").length,
    gridOutageMinutes: round(gridOutageMs / 60_000, 1),
  };
}

export function buildReportSnapshot(input: ReportSnapshotInput): ReportSnapshot {
  const solarUsedWh = Math.max(0, input.history.summary.generationWh - input.history.summary.exportWh);
  const selfSufficiencyPct = input.history.summary.consumptionWh ? solarUsedWh / input.history.summary.consumptionWh * 100 : 0;
  const snapshot: ReportSnapshot = {
    schemaVersion: "1.0",
    generatedAt: input.generatedAt.toISOString(),
    site: input.site,
    period: { type: input.period.type, from: input.period.from.toISOString(), to: input.period.to.toISOString(), label: periodLabel(input.period.type, input.period.from, input.period.to, input.site.timezone) },
    provenance: {
      sourceLabel: input.site.mode === "SIMULATED" ? "Simulated gateway data" : "Measured gateway data",
      completenessPct: input.history.completenessPct,
      dataCutoffAt: input.period.to.toISOString(),
    },
    energy: {
      generationKwh: round(input.history.summary.generationWh / 1_000),
      consumptionKwh: round(input.history.summary.consumptionWh / 1_000),
      selfConsumptionPct: round(input.history.summary.selfConsumptionPct),
      selfSufficiencyPct: round(selfSufficiencyPct),
      gridImportKwh: round(input.history.summary.importWh / 1_000),
      gridExportKwh: round(input.history.summary.exportWh / 1_000),
      batteryChargeKwh: round(input.history.points.reduce((sum, point) => sum + point.batteryChargeWh, 0) / 1_000),
      batteryDischargeKwh: round(input.history.points.reduce((sum, point) => sum + point.batteryDischargeWh, 0) / 1_000),
    },
    performance: {
      expectedGenerationKwh: round(input.performance.summary.expectedGenerationWh / 1_000),
      performanceRatioPct: input.performance.summary.performanceRatioPct,
      estimatedLossKwh: round(input.performance.summary.estimatedLossWh / 1_000),
      availabilityPct: input.performance.summary.availabilityPct,
      configuredCapacityKwp: round(input.performance.summary.configuredCapacityW / 1_000, 2),
    },
    forecastAccuracy: forecastAccuracy(input.verifications),
    alerts: alertSummary(input.incidents, input.period.from, input.period.to),
    environmentalEstimate: { avoidedCo2eKg: round(input.history.summary.generationWh / 1_000 * 0.7), factorKgPerKwh: 0.7, isIllustrative: true },
    daily: input.history.points.map((point) => ({
      date: point.bucketStart.slice(0, 10), label: point.label, generationKwh: round(point.generationWh / 1_000), consumptionKwh: round(point.consumptionWh / 1_000),
      gridImportKwh: round(point.importWh / 1_000), gridExportKwh: round(point.exportWh / 1_000), batteryChargeKwh: round(point.batteryChargeWh / 1_000),
      batteryDischargeKwh: round(point.batteryDischargeWh / 1_000), averageIrradianceWm2: point.averageIrradianceWm2, sampleCount: point.sampleCount,
    })),
  };
  return reportSnapshotSchema.parse(snapshot);
}

function csvCell(value: string | number | null) {
  if (value === null) return "";
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function reportSnapshotToCsv(report: ReportSnapshot) {
  const rows: Array<Array<string | number | null>> = [
    ["aelora_report_schema", report.schemaVersion], ["site_name", report.site.name], ["site_timezone", report.site.timezone], ["site_mode", report.site.mode],
    ["report_type", report.period.type], ["period_from", report.period.from], ["period_to", report.period.to], ["generated_at", report.generatedAt],
    [], ["metric", "value", "unit"],
    ["generation_kwh", report.energy.generationKwh, "kWh"], ["consumption_kwh", report.energy.consumptionKwh, "kWh"],
    ["self_consumption_pct", report.energy.selfConsumptionPct, "%"], ["self_sufficiency_pct", report.energy.selfSufficiencyPct, "%"],
    ["grid_import_kwh", report.energy.gridImportKwh, "kWh"], ["grid_export_kwh", report.energy.gridExportKwh, "kWh"],
    ["performance_ratio_pct", report.performance.performanceRatioPct, "%"], ["availability_pct", report.performance.availabilityPct, "%"],
    ["forecast_mae_kwh", report.forecastAccuracy.maeKwh, "kWh"], ["alert_count", report.alerts.total, "incidents"],
    [], ["date", "generation_kwh", "consumption_kwh", "grid_import_kwh", "grid_export_kwh", "battery_charge_kwh", "battery_discharge_kwh", "average_irradiance_wm2", "sample_count"],
    ...report.daily.map((point) => [point.date, point.generationKwh, point.consumptionKwh, point.gridImportKwh, point.gridExportKwh, point.batteryChargeKwh, point.batteryDischargeKwh, point.averageIrradianceWm2, point.sampleCount]),
  ];
  return rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
}
