import "server-only";

import type { UserRole } from "@/lib/auth/authorization";
import { db } from "@/lib/db";
import {
  evaluateForecastSamples,
  integrateGenerationInterval,
  type ForecastActualQuality,
  type ForecastEvaluationView,
  type ForecastVerificationSample,
} from "@/lib/forecast/verification";

export type VerificationActor = { id: string; role: UserRole };

export class VerificationDomainError extends Error {
  constructor(public readonly code: "site_not_found") {
    super(code);
    this.name = "VerificationDomainError";
  }
}

function siteWhere(actor: VerificationActor, siteId: string) {
  return {
    id: siteId,
    deletedAt: null,
    ...(actor.role === "ADMIN" ? {} : { ownerId: actor.id }),
  };
}

async function findEvaluationSite(actor: VerificationActor, siteId: string) {
  const site = await db.solarSite.findFirst({
    where: siteWhere(actor, siteId),
    select: {
      id: true,
      timezone: true,
      gateways: {
        where: { revokedAt: null },
        orderBy: { lastTelemetryAt: "desc" },
        take: 1,
        select: { expectedIntervalSec: true },
      },
    },
  });
  if (!site) throw new VerificationDomainError("site_not_found");
  return site;
}

function lowerBound(readings: Array<{ observedAt: Date }>, target: number) {
  let left = 0;
  let right = readings.length;
  while (left < right) {
    const middle = Math.floor((left + right) / 2);
    if (readings[middle].observedAt.getTime() < target) left = middle + 1;
    else right = middle;
  }
  return left;
}

export async function refreshSiteForecastVerification(
  actor: VerificationActor,
  siteId: string,
  now = new Date(),
) {
  const site = await findEvaluationSite(actor, siteId);
  const completedBefore = new Date(now.getTime() - 3_600_000);
  const points = await db.solarForecastPoint.findMany({
    where: {
      forecastRun: { siteId: site.id },
      validAt: { lte: completedBefore },
      verification: null,
    },
    orderBy: { validAt: "asc" },
    take: 2_000,
    select: {
      id: true,
      validAt: true,
      leadHours: true,
      estimatedEnergyKwh: true,
      forecastRun: { select: { issuedAt: true, artifactSha256: true } },
    },
  });
  if (!points.length) return { considered: 0, persisted: 0, withheld: 0 };

  const firstStart = points[0].validAt;
  const lastEnd = new Date(points.at(-1)!.validAt.getTime() + 3_600_000);
  const readings = await db.telemetryReading.findMany({
    where: {
      siteId: site.id,
      observedAt: { gte: firstStart, lt: lastEnd },
      quality: { in: ["SIMULATED", "MEASURED", "ESTIMATED"] },
    },
    orderBy: { observedAt: "asc" },
    select: { observedAt: true, pvPowerW: true, quality: true },
  });
  const expectedIntervalSec = site.gateways[0]?.expectedIntervalSec ?? 30;
  const records = points.flatMap((point) => {
    const intervalEnd = new Date(point.validAt.getTime() + 3_600_000);
    const fromIndex = lowerBound(readings, point.validAt.getTime());
    const toIndex = lowerBound(readings, intervalEnd.getTime());
    const label = integrateGenerationInterval(
      readings.slice(fromIndex, toIndex),
      point.validAt,
      intervalEnd,
      expectedIntervalSec,
    );
    if (!label.eligible || label.actualEnergyKwh == null || label.actualQuality == null) return [];
    const errorKwh = point.estimatedEnergyKwh - label.actualEnergyKwh;
    return [{
      solarForecastPointId: point.id,
      intervalStartAt: point.validAt,
      intervalEndAt: intervalEnd,
      actualEnergyKwh: label.actualEnergyKwh,
      errorKwh,
      absoluteErrorKwh: Math.abs(errorKwh),
      squaredErrorKwh2: errorKwh ** 2,
      coveragePct: label.coveragePct,
      sampleCount: label.sampleCount,
      sampleIntervalSec: label.sampleIntervalSec,
      actualQuality: label.actualQuality,
      verifiedAt: now,
    }];
  });
  if (!records.length) {
    return { considered: points.length, persisted: 0, withheld: points.length };
  }
  const persisted = await db.solarForecastVerification.createMany({
    data: records,
    skipDuplicates: true,
  });
  return {
    considered: points.length,
    persisted: persisted.count,
    withheld: points.length - records.length,
  };
}

export async function getSiteForecastEvaluation(
  actor: VerificationActor,
  siteId: string,
): Promise<ForecastEvaluationView> {
  const site = await findEvaluationSite(actor, siteId);
  const verifications = await db.solarForecastVerification.findMany({
    where: { point: { forecastRun: { siteId: site.id } } },
    orderBy: { verifiedAt: "desc" },
    take: 5_000,
    select: {
      actualEnergyKwh: true,
      actualQuality: true,
      verifiedAt: true,
      point: {
        select: {
          id: true,
          validAt: true,
          leadHours: true,
          estimatedEnergyKwh: true,
          forecastRun: { select: { issuedAt: true, artifactSha256: true } },
        },
      },
    },
  });
  const samples: ForecastVerificationSample[] = verifications.map((verification) => ({
    forecastPointId: verification.point.id,
    artifactSha256: verification.point.forecastRun.artifactSha256,
    forecastIssuedAt: verification.point.forecastRun.issuedAt.toISOString(),
    validAt: verification.point.validAt.toISOString(),
    leadHours: verification.point.leadHours,
    estimatedEnergyKwh: verification.point.estimatedEnergyKwh,
    actualEnergyKwh: verification.actualEnergyKwh,
    actualQuality: verification.actualQuality as ForecastActualQuality,
  }));
  return {
    siteId: site.id,
    evaluatedAt: new Date().toISOString(),
    ...evaluateForecastSamples(samples, site.timezone),
  };
}
