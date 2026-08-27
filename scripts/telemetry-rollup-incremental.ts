import "dotenv/config";

import { db } from "../lib/db";
import { runIncrementalTelemetryRollups } from "../lib/telemetry/rollup-service";

async function main() {
  const result = await runIncrementalTelemetryRollups();
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (result.failed) process.exitCode = 1;
}

main().finally(() => db.$disconnect());
