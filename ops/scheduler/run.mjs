import { pathToFileURL } from "node:url";

const jobs = [
  "/api/internal/telemetry-rollups",
  "/api/internal/intelligence-refresh",
];

function readConfiguration(env) {
  const rawUrl = env.AELORA_WEB_INTERNAL_URL;
  if (!rawUrl) throw new Error("AELORA_WEB_INTERNAL_URL is required.");

  const baseUrl = new URL(rawUrl);
  if (!new Set(["http:", "https:"]).has(baseUrl.protocol)) {
    throw new Error("AELORA_WEB_INTERNAL_URL must use http or https.");
  }
  if (baseUrl.username || baseUrl.password) {
    throw new Error("AELORA_WEB_INTERNAL_URL must not contain credentials.");
  }
  if (
    baseUrl.protocol === "http:" &&
    baseUrl.hostname !== "localhost" &&
    baseUrl.hostname !== "127.0.0.1" &&
    !baseUrl.hostname.endsWith(".railway.internal")
  ) {
    throw new Error("Plain HTTP is allowed only for localhost or Railway private networking.");
  }

  const secret = env.WEATHER_SYNC_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("WEATHER_SYNC_SECRET must contain at least 32 characters.");
  }

  return { baseUrl, secret };
}

export async function runScheduledJobs({
  env = process.env,
  fetchImpl = fetch,
  log = console,
} = {}) {
  const { baseUrl, secret } = readConfiguration(env);
  let completed = 0;

  for (const path of jobs) {
    const startedAt = Date.now();
    const response = await fetchImpl(new URL(path, baseUrl), {
      method: "POST",
      headers: { authorization: `Bearer ${secret}` },
      signal: AbortSignal.timeout(120_000),
    });

    if (!response.ok) {
      log.error(`Scheduled job ${path} failed with HTTP ${response.status}.`);
      throw new Error(`Scheduled job ${path} failed with HTTP ${response.status}.`);
    }

    completed += 1;
    log.info(`Scheduled job ${path} completed in ${Date.now() - startedAt} ms.`);
  }

  return { completed };
}

const entrypoint = process.argv[1] ? pathToFileURL(process.argv[1]).href : undefined;
if (entrypoint === import.meta.url) {
  runScheduledJobs().catch((error) => {
    console.error(error instanceof Error ? error.message : "Scheduled jobs failed.");
    process.exitCode = 1;
  });
}
