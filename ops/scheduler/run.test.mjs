import assert from "node:assert/strict";
import test from "node:test";

import { runScheduledJobs } from "./run.mjs";

const validEnv = {
  AELORA_WEB_INTERNAL_URL: "http://aelora-web.railway.internal:3000",
  WEATHER_SYNC_SECRET: "scheduler-secret-that-is-at-least-32-characters",
};

test("scheduler rejects incomplete or unsafe configuration before sending requests", async () => {
  await assert.rejects(
    () => runScheduledJobs({ env: {}, fetchImpl: async () => new Response() }),
    /AELORA_WEB_INTERNAL_URL/,
  );
  await assert.rejects(
    () =>
      runScheduledJobs({
        env: { ...validEnv, AELORA_WEB_INTERNAL_URL: "file:///etc/passwd" },
        fetchImpl: async () => new Response(),
      }),
    /http or https/,
  );
});

test("scheduler calls both private jobs with the bearer token and no request body", async () => {
  const requests = [];
  const result = await runScheduledJobs({
    env: validEnv,
    fetchImpl: async (url, init) => {
      requests.push({ url: String(url), init });
      return Response.json({ ok: true });
    },
    log: { info() {}, error() {} },
  });

  assert.equal(result.completed, 2);
  assert.deepEqual(
    requests.map(({ url }) => new URL(url).pathname),
    ["/api/internal/telemetry-rollups", "/api/internal/intelligence-refresh"],
  );
  for (const request of requests) {
    assert.equal(request.init.method, "POST");
    assert.equal(
      request.init.headers.authorization,
      "Bearer scheduler-secret-that-is-at-least-32-characters",
    );
    assert.equal(request.init.body, undefined);
  }
});

test("scheduler exits unsuccessfully when any job is rejected", async () => {
  await assert.rejects(
    () =>
      runScheduledJobs({
        env: validEnv,
        fetchImpl: async () => new Response("upstream failed", { status: 503 }),
        log: { info() {}, error() {} },
      }),
    /503/,
  );
});
