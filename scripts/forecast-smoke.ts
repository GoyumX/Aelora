import "dotenv/config";

import { db } from "../lib/db";
import { generateSiteForecast } from "../lib/forecast/forecast-service";

async function main() {
  const site = await db.solarSite.findFirst({
    where: {
      deletedAt: null,
      status: "ACTIVE",
      arrays: { some: { archivedAt: null, status: "ACTIVE" } },
      weatherForecastRuns: { some: {} },
    },
    orderBy: { createdAt: "asc" },
    select: { id: true, ownerId: true, name: true },
  });
  if (!site) throw new Error("No active site with arrays and stored weather is available.");

  const forecast = await generateSiteForecast(
    { id: site.ownerId, role: "USER" },
    site.id,
  );
  console.log(JSON.stringify({
    forecastId: forecast.id,
    site: site.name,
    modelStatus: forecast.model.status,
    productionActivationAllowed: forecast.model.productionActivationAllowed,
    points: forecast.points.length,
    estimatedEnergyKwh: forecast.totals.estimatedEnergyKwh,
    estimatedLoadEnergyKwh: forecast.totals.estimatedLoadEnergyKwh,
    loadForecastMethod: forecast.loadForecast.method,
    weatherFetchedAt: forecast.weather.fetchedAt,
  }, null, 2));
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "Forecast smoke test failed.");
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
