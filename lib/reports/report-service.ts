import "server-only";

import { createHash } from "node:crypto";

import type { Prisma } from "@prisma/client";

import { canAccessSite, type UserRole } from "@/lib/auth/authorization";
import { db } from "@/lib/db";
import { getSitePerformanceReport } from "@/lib/performance/performance-service";
import {
  buildReportSnapshot,
  reportPeriodRequestSchema,
  reportSnapshotSchema,
  type ReportSnapshot,
  type ReportType,
} from "@/lib/reports/report";
import { getHistoricalTelemetry } from "@/lib/telemetry/history-service";

const DAY_MS = 86_400_000;
type ReportActor = { id: string; role?: UserRole | string | null };
export type ReportPeriodRequest = { type: ReportType; from: string; to: string };

export class ReportDomainError extends Error {
  constructor(public code: "SITE_NOT_FOUND" | "REPORT_NOT_FOUND" | "INVALID_PERIOD" | "CORRUPT_REPORT") {
    super(code);
  }
}

export type StoredReport = {
  id: string;
  type: ReportType;
  generatedAt: string;
  dataHash: string;
  payload: ReportSnapshot;
};

export type ReportsView = {
  site: { id: string; name: string; timezone: string; mode: "SIMULATED" | "HARDWARE" };
  suggestedPeriods: Array<ReportPeriodRequest & { label: string }>;
  reports: StoredReport[];
};

const siteSelect = { id: true, ownerId: true, name: true, timezone: true, mode: true } as const;

async function findAccessibleSite(actor: ReportActor, siteId: string) {
  const site = await db.solarSite.findFirst({ where: { id: siteId, deletedAt: null }, select: siteSelect });
  if (!site || !canAccessSite(actor, site.ownerId)) throw new ReportDomainError("SITE_NOT_FOUND");
  return site;
}

function localDateKey(value: Date, timezone: string) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(value).map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function zonedMidnight(dateKey: string, timezone: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const targetWallTime = Date.UTC(year, month - 1, day);
  let instant = targetWallTime;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const parts = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: timezone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(new Date(instant)).map((part) => [part.type, part.value]));
    const representedWallTime = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second));
    instant -= representedWallTime - targetWallTime;
  }
  return new Date(instant);
}

function dateKey(value: Date) {
  return value.toISOString().slice(0, 10);
}

function suggestionLabel(type: ReportType, from: string, to: string) {
  const fromDate = new Date(`${from}T12:00:00.000Z`);
  if (type === "MONTHLY") return new Intl.DateTimeFormat("en", { month: "long", year: "numeric", timeZone: "UTC" }).format(fromDate);
  const endDate = new Date(new Date(`${to}T00:00:00.000Z`).getTime() - DAY_MS);
  const start = new Intl.DateTimeFormat("en", { month: "short", day: "numeric", timeZone: "UTC" }).format(fromDate);
  const end = new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(endDate);
  return `${start}–${end}`;
}

export function suggestedReportPeriods(now: Date, timezone: string): ReportsView["suggestedPeriods"] {
  const localToday = new Date(`${localDateKey(now, timezone)}T00:00:00.000Z`);
  const daysSinceMonday = (localToday.getUTCDay() + 6) % 7;
  const weekTo = new Date(localToday.getTime() - daysSinceMonday * DAY_MS);
  const weekFrom = new Date(weekTo.getTime() - 7 * DAY_MS);
  const monthTo = new Date(Date.UTC(localToday.getUTCFullYear(), localToday.getUTCMonth(), 1));
  const monthFrom = new Date(Date.UTC(monthTo.getUTCFullYear(), monthTo.getUTCMonth() - 1, 1));
  return [
    { type: "WEEKLY", from: dateKey(weekFrom), to: dateKey(weekTo), label: suggestionLabel("WEEKLY", dateKey(weekFrom), dateKey(weekTo)) },
    { type: "MONTHLY", from: dateKey(monthFrom), to: dateKey(monthTo), label: suggestionLabel("MONTHLY", dateKey(monthFrom), dateKey(monthTo)) },
  ];
}

function storedReport(record: { id: string; type: ReportType; generatedAt: Date; dataHash: string; payload: Prisma.JsonValue }): StoredReport {
  const parsed = reportSnapshotSchema.safeParse(record.payload);
  if (!parsed.success) throw new ReportDomainError("CORRUPT_REPORT");
  return { id: record.id, type: record.type, generatedAt: record.generatedAt.toISOString(), dataHash: record.dataHash, payload: parsed.data };
}

export async function getReportsView(actor: ReportActor, siteId: string, now = new Date()): Promise<ReportsView> {
  const site = await findAccessibleSite(actor, siteId);
  const records = await db.reportSnapshot.findMany({
    where: { siteId },
    orderBy: { generatedAt: "desc" },
    take: 24,
    select: { id: true, type: true, generatedAt: true, dataHash: true, payload: true },
  });
  return {
    site: { id: site.id, name: site.name, timezone: site.timezone, mode: site.mode },
    suggestedPeriods: suggestedReportPeriods(now, site.timezone),
    reports: records.map(storedReport),
  };
}

function stableDataHash(snapshot: ReportSnapshot) {
  const stableContent = Object.fromEntries(Object.entries(snapshot).filter(([key]) => key !== "generatedAt"));
  return createHash("sha256").update(JSON.stringify(stableContent)).digest("hex");
}

export async function generateReportSnapshot(actor: ReportActor, siteId: string, request: ReportPeriodRequest, now = new Date()): Promise<StoredReport> {
  const parsed = reportPeriodRequestSchema.safeParse(request);
  if (!parsed.success) throw new ReportDomainError("INVALID_PERIOD");
  const site = await findAccessibleSite(actor, siteId);
  const from = zonedMidnight(parsed.data.from, site.timezone);
  const to = zonedMidnight(parsed.data.to, site.timezone);
  const [history, performance, incidents, verifications] = await Promise.all([
    getHistoricalTelemetry({ id: site.id, name: site.name, timezone: site.timezone }, from, to, "day"),
    getSitePerformanceReport(site.id, from, to),
    db.alertIncident.findMany({
      where: { siteId, firstDetectedAt: { lt: to }, OR: [{ resolvedAt: null }, { resolvedAt: { gte: from } }, { lastDetectedAt: { gte: from } }] },
      orderBy: { firstDetectedAt: "asc" },
      select: { severity: true, status: true, type: true, firstDetectedAt: true, lastDetectedAt: true, resolvedAt: true },
    }),
    db.solarForecastVerification.findMany({
      where: { intervalStartAt: { gte: from, lt: to }, point: { forecastRun: { siteId } } },
      orderBy: { intervalStartAt: "asc" },
      select: { errorKwh: true, absoluteErrorKwh: true, squaredErrorKwh2: true, actualEnergyKwh: true, actualQuality: true },
    }),
  ]);
  if (!performance) throw new ReportDomainError("SITE_NOT_FOUND");
  const snapshot = buildReportSnapshot({ generatedAt: now, site: { id: site.id, name: site.name, timezone: site.timezone, mode: site.mode }, period: { type: parsed.data.type, from, to }, history, performance, incidents, verifications });
  const dataHash = stableDataHash(snapshot);
  const record = await db.reportSnapshot.upsert({
    where: { siteId_type_periodStartAt_periodEndAt_dataHash: { siteId, type: parsed.data.type, periodStartAt: from, periodEndAt: to, dataHash } },
    create: { siteId, generatedById: actor.id, type: parsed.data.type, periodStartAt: from, periodEndAt: to, generatedAt: now, schemaVersion: snapshot.schemaVersion, dataHash, payload: snapshot as Prisma.InputJsonValue },
    update: {},
    select: { id: true, type: true, generatedAt: true, dataHash: true, payload: true },
  });
  return storedReport(record);
}

export async function getReportSnapshot(actor: ReportActor, siteId: string, reportId: string) {
  await findAccessibleSite(actor, siteId);
  const record = await db.reportSnapshot.findFirst({ where: { id: reportId, siteId }, select: { id: true, type: true, generatedAt: true, dataHash: true, payload: true } });
  if (!record) throw new ReportDomainError("REPORT_NOT_FOUND");
  return storedReport(record);
}
