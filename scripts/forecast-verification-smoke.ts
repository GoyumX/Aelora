import "dotenv/config";

import { db } from "../lib/db";
import {
  getSiteForecastEvaluation,
  refreshSiteForecastVerification,
} from "../lib/forecast/verification-service";

async function main() {
  const startedAt = Date.now();
  const site = await db.solarSite.findFirst({
    where: {
      deletedAt: null,
      status: "ACTIVE",
      solarForecastRuns: { some: {} },
    },
    orderBy: { createdAt: "asc" },
    select: { id: true, ownerId: true, name: true },
  });
  if (!site) throw new Error("No active site with a stored forecast is available.");

  const actor = { id: site.ownerId, role: "USER" as const };
  const refreshStartedAt = Date.now();
  const refresh = await refreshSiteForecastVerification(actor, site.id);
  const refreshDurationMs = Date.now() - refreshStartedAt;
  const evaluationStartedAt = Date.now();
  const evaluation = await getSiteForecastEvaluation(actor, site.id);
  const evaluationDurationMs = Date.now() - evaluationStartedAt;

  console.log(JSON.stringify({
    site: site.name,
    durationMs: {
      refresh: refreshDurationMs,
      evaluation: evaluationDurationMs,
      total: Date.now() - startedAt,
    },
    refresh,
    evidenceQuality: evaluation.evidenceQuality,
    verifiedDaylightHours: evaluation.overall.sampleCount,
    maeKwh: evaluation.overall.maeKwh,
    rmseKwh: evaluation.overall.rmseKwh,
    wMapePct: evaluation.overall.wMapePct,
    horizonSlices: evaluation.slices.map((slice) => ({
      horizon: slice.label,
      sampleCount: slice.sampleCount,
      maeKwh: slice.maeKwh,
      wMapePct: slice.wMapePct,
    })),
    calibration: evaluation.calibration.map((slice) => ({
      horizon: slice.label,
      status: slice.status,
      sampleCount: slice.sampleCount,
      halfWidthKwh: slice.halfWidthKwh,
    })),
    promotion: evaluation.promotion,
  }, null, 2));
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "Forecast verification smoke test failed.");
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
