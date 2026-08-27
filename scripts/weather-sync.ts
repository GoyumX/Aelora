import "dotenv/config";

import { db } from "../lib/db";
import { syncAllActiveSiteWeather } from "../lib/weather/weather-service";

async function main() {
  const result = await syncAllActiveSiteWeather();
  console.log(JSON.stringify(result, null, 2));
  if (result.failed > 0) process.exitCode = 1;
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "Weather sync failed.");
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
