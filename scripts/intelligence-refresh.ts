import "dotenv/config";

import { db } from "../lib/db";
import { refreshAllStaleSiteForecasts } from "../lib/forecast/forecast-service";
import { syncAllActiveSiteWeather } from "../lib/weather/weather-service";

async function main() {
  const now = new Date();
  const weather = await syncAllActiveSiteWeather(now);
  const forecast = await refreshAllStaleSiteForecasts(now);
  console.log(JSON.stringify({ weather, forecast }, null, 2));
  if (weather.failed > 0 || forecast.failed > 0) process.exitCode = 1;
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "Intelligence refresh failed.");
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
