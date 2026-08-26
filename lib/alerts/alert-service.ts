import "server-only";

import { Prisma } from "@prisma/client";

import { detectAlertCandidates } from "@/lib/alerts/detection";
import { planIncidentReconciliation } from "@/lib/alerts/lifecycle";
import type { AlertIncidentView, AlertsView } from "@/lib/alerts/types";
import type { UserRole } from "@/lib/auth/authorization";
import { db } from "@/lib/db";

type Actor = { id: string; role: UserRole };

export class AlertDomainError extends Error {
  constructor(public code: "SITE_NOT_FOUND" | "ALERT_NOT_FOUND" | "ALREADY_RESOLVED") {
    super(code);
  }
}

const siteEvidenceSelect = {
  id: true,
  name: true,
  timezone: true,
  mode: true,
  arrays: {
    where: { status: "ACTIVE" as const, archivedAt: null },
    select: { panelCount: true, ratedPowerW: true },
  },
  battery: {
    select: { enabled: true, status: true, reservePct: true },
  },
  gateways: {
    where: { revokedAt: null },
    orderBy: { createdAt: "desc" as const },
    take: 1,
    select: {
      id: true,
      name: true,
      lastSeenAt: true,
      expectedIntervalSec: true,
      devices: {
        select: {
          externalId: true,
          name: true,
          kind: true,
          lastSeenAt: true,
          expectedIntervalSec: true,
          operationalState: true,
        },
      },
    },
  },
} as const;

function accessWhere(actor: Actor, siteId: string) {
  return {
    id: siteId,
    deletedAt: null,
    ...(actor.role === "ADMIN" ? {} : { ownerId: actor.id }),
  };
}

function serializeIncident(incident: {
  id: string;
  type: AlertIncidentView["type"];
  severity: AlertIncidentView["severity"];
  status: AlertIncidentView["status"];
  title: string;
  summary: string;
  evidenceQuality: AlertIncidentView["evidenceQuality"];
  evidence: unknown;
  firstDetectedAt: Date;
  lastDetectedAt: Date;
  occurrenceCount: number;
  acknowledgedAt: Date | null;
  resolvedAt: Date | null;
  resolutionReason: string | null;
}): AlertIncidentView {
  return {
    ...incident,
    evidence: incident.evidence && typeof incident.evidence === "object" && !Array.isArray(incident.evidence)
      ? incident.evidence as Record<string, unknown>
      : {},
    firstDetectedAt: incident.firstDetectedAt.toISOString(),
    lastDetectedAt: incident.lastDetectedAt.toISOString(),
    acknowledgedAt: incident.acknowledgedAt?.toISOString() ?? null,
    resolvedAt: incident.resolvedAt?.toISOString() ?? null,
  };
}

async function evaluateSite(site: Awaited<ReturnType<typeof findSiteEvidence>>, now: Date) {
  if (!site) throw new AlertDomainError("SITE_NOT_FOUND");
  const gateway = site.gateways[0] ?? null;
  const readings = await db.telemetryReading.findMany({
    where: { siteId: site.id },
    orderBy: { observedAt: "desc" },
    take: 20,
    select: {
      observedAt: true,
      quality: true,
      pvPowerW: true,
      batterySocPct: true,
      gridVoltageV: true,
      irradianceWm2: true,
      deviceStatus: true,
    },
  });
  const detection = detectAlertCandidates({
    now,
    siteId: site.id,
    siteMode: site.mode,
    installedCapacityW: site.arrays.reduce((total, array) => total + array.panelCount * array.ratedPowerW, 0),
    batteryReservePct: site.battery?.enabled && site.battery.status === "ACTIVE" ? site.battery.reservePct : null,
    gateway,
    devices: gateway?.devices ?? [],
    readings: readings.reverse(),
  });
  const existing = await db.alertIncident.findMany({
    where: { siteId: site.id, status: { in: ["ACTIVE", "ACKNOWLEDGED"] }, openKey: { not: null } },
    select: { id: true, openKey: true, type: true, status: true },
  });
  const plan = planIncidentReconciliation(
    site.id,
    existing.map((item) => ({
      ...item,
      openKey: item.openKey!,
      status: item.status === "ACKNOWLEDGED" ? "ACKNOWLEDGED" as const : "ACTIVE" as const,
    })),
    detection.candidates,
    detection.evaluatedTypes,
    now,
  );

  const operations = [
    ...plan.creates.map((item) => db.alertIncident.create({
      data: {
        siteId: site.id,
        openKey: item.openKey,
        type: item.type,
        severity: item.severity,
        status: item.status,
        title: item.title,
        summary: item.summary,
        evidenceQuality: item.evidenceQuality,
        evidence: item.evidence as Prisma.InputJsonValue,
        firstDetectedAt: item.firstDetectedAt,
        lastDetectedAt: item.lastDetectedAt,
        occurrenceCount: item.occurrenceCount,
      },
    })),
    ...plan.updates.map((item) => db.alertIncident.update({
      where: { id: item.id },
      data: {
        severity: item.severity,
        title: item.title,
        summary: item.summary,
        evidenceQuality: item.evidenceQuality,
        evidence: item.evidence as Prisma.InputJsonValue,
        lastDetectedAt: item.lastDetectedAt,
        occurrenceCount: { increment: item.occurrenceIncrement },
      },
    })),
    ...plan.resolves.map((item) => db.alertIncident.update({
      where: { id: item.id },
      data: {
        openKey: null,
        status: "RESOLVED",
        resolvedAt: item.resolvedAt,
        resolutionReason: item.resolutionReason,
      },
    })),
  ];
  if (operations.length) await db.$transaction(operations);
  return {
    created: plan.creates.length,
    updated: plan.updates.length,
    resolved: plan.resolves.length,
    detected: detection.candidates.length,
  };
}

async function findSiteEvidence(siteId: string) {
  return db.solarSite.findFirst({
    where: { id: siteId, deletedAt: null },
    select: siteEvidenceSelect,
  });
}

export async function evaluateAlertsForSiteId(siteId: string, now = new Date()) {
  return evaluateSite(await findSiteEvidence(siteId), now);
}

export async function refreshSiteAlerts(actor: Actor, siteId: string, now = new Date()) {
  const site = await db.solarSite.findFirst({ where: accessWhere(actor, siteId), select: siteEvidenceSelect });
  return evaluateSite(site, now);
}

export async function getSiteAlertsView(actor: Actor, siteId: string): Promise<AlertsView> {
  const site = await db.solarSite.findFirst({
    where: accessWhere(actor, siteId),
    select: { id: true, name: true, timezone: true, mode: true },
  });
  if (!site) throw new AlertDomainError("SITE_NOT_FOUND");

  const [incidents, open, critical, acknowledged, resolved] = await Promise.all([
    db.alertIncident.findMany({
      where: { siteId },
      orderBy: [{ status: "asc" }, { lastDetectedAt: "desc" }],
      take: 100,
      select: {
        id: true,
        type: true,
        severity: true,
        status: true,
        title: true,
        summary: true,
        evidenceQuality: true,
        evidence: true,
        firstDetectedAt: true,
        lastDetectedAt: true,
        occurrenceCount: true,
        acknowledgedAt: true,
        resolvedAt: true,
        resolutionReason: true,
      },
    }),
    db.alertIncident.count({ where: { siteId, status: { in: ["ACTIVE", "ACKNOWLEDGED"] } } }),
    db.alertIncident.count({ where: { siteId, severity: "CRITICAL", status: { in: ["ACTIVE", "ACKNOWLEDGED"] } } }),
    db.alertIncident.count({ where: { siteId, status: "ACKNOWLEDGED" } }),
    db.alertIncident.count({ where: { siteId, status: "RESOLVED" } }),
  ]);
  return {
    site,
    summary: { open, critical, acknowledged, resolved },
    incidents: incidents.map(serializeIncident),
  };
}

export async function getPrimaryAlertsView(actor: Actor): Promise<AlertsView | null> {
  const site = await db.solarSite.findFirst({
    where: { deletedAt: null, ...(actor.role === "ADMIN" ? {} : { ownerId: actor.id }) },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  return site ? getSiteAlertsView(actor, site.id) : null;
}

export async function updateSiteAlert(
  actor: Actor,
  siteId: string,
  alertId: string,
  action: "ACKNOWLEDGE" | "RESOLVE",
  now = new Date(),
): Promise<AlertIncidentView> {
  const site = await db.solarSite.findFirst({ where: accessWhere(actor, siteId), select: { id: true } });
  if (!site) throw new AlertDomainError("SITE_NOT_FOUND");
  const incident = await db.alertIncident.findFirst({ where: { id: alertId, siteId } });
  if (!incident) throw new AlertDomainError("ALERT_NOT_FOUND");
  if (incident.status === "RESOLVED") throw new AlertDomainError("ALREADY_RESOLVED");

  const updated = await db.alertIncident.update({
    where: { id: incident.id },
    data: action === "ACKNOWLEDGE"
      ? { status: "ACKNOWLEDGED", acknowledgedAt: incident.acknowledgedAt ?? now, acknowledgedById: actor.id }
      : { status: "RESOLVED", openKey: null, resolvedAt: now, resolvedById: actor.id, resolutionReason: "MANUAL_RESOLUTION" },
    select: {
      id: true,
      type: true,
      severity: true,
      status: true,
      title: true,
      summary: true,
      evidenceQuality: true,
      evidence: true,
      firstDetectedAt: true,
      lastDetectedAt: true,
      occurrenceCount: true,
      acknowledgedAt: true,
      resolvedAt: true,
      resolutionReason: true,
    },
  });
  return serializeIncident(updated);
}
