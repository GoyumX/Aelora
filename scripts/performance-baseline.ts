import "dotenv/config";

import fs from "node:fs";
import path from "node:path";

import { chromium, type Page } from "@playwright/test";
import pg from "pg";

import { summarizeSamples, type SampleSummary } from "../lib/benchmark/statistics";

const { Client } = pg;
const baseUrl = process.env.AELORA_BENCHMARK_BASE_URL ?? "http://localhost:3000";
const outputDirectory = path.resolve("docs/evidence/step-28-performance-and-database");
const browserExecutable = process.env.PLAYWRIGHT_EXECUTABLE_PATH
  ?? (process.platform === "win32" ? "C:/Program Files/Google/Chrome/Application/chrome.exe" : undefined);
const pageRuns = positiveInteger(process.env.AELORA_BENCHMARK_PAGE_RUNS, 5);
const apiRuns = positiveInteger(process.env.AELORA_BENCHMARK_API_RUNS, 30);
const apiConcurrency = positiveInteger(process.env.AELORA_BENCHMARK_CONCURRENCY, 5);

type PageResult = {
  route: string;
  navigationMs: SampleSummary;
  ttfbMs: SampleSummary;
  lcpMs: SampleSummary;
  cls: SampleSummary;
  transferredKb: SampleSummary;
};

type ApiResult = {
  name: string;
  path: string;
  latencyMs: SampleSummary;
  averageResponseKb: number;
  statusCounts: Record<string, number>;
  errorRatePct: number;
  passed: boolean;
};

function positiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}

function escapeHtml(value: unknown) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function signIn(page: Page) {
  const password = process.env.SEED_USER_PASSWORD;
  if (!password) throw new Error("SEED_USER_PASSWORD is required to run the authenticated benchmark.");

  await page.goto(`${baseUrl}/sign-in`, { waitUntil: "networkidle" });
  await page.getByLabel("Email address").fill(process.env.SEED_USER_EMAIL ?? "user@aelora.local");
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/dashboard$/);
}

async function measurePage(page: Page, route: string): Promise<PageResult> {
  await page.goto(`${baseUrl}${route}`, { waitUntil: "networkidle" });

  const measurements: Array<{
    navigationMs: number;
    ttfbMs: number;
    lcpMs: number;
    cls: number;
    transferredKb: number;
  }> = [];

  for (let run = 0; run < pageRuns; run += 1) {
    await page.goto(`${baseUrl}${route}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(350);

    measurements.push(await page.evaluate(() => {
      const navigation = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming;
      const resources = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
      const vitals = (window as Window & {
        __aeloraVitals?: { lcp: number; cls: number };
      }).__aeloraVitals ?? { lcp: 0, cls: 0 };

      return {
        navigationMs: navigation.duration,
        ttfbMs: navigation.responseStart,
        lcpMs: vitals.lcp,
        cls: vitals.cls,
        transferredKb: resources.reduce((total, resource) => total + resource.transferSize, 0) / 1024,
      };
    }));
  }

  return {
    route,
    navigationMs: summarizeSamples(measurements.map((sample) => sample.navigationMs), 2_500),
    ttfbMs: summarizeSamples(measurements.map((sample) => sample.ttfbMs), 800),
    lcpMs: summarizeSamples(measurements.map((sample) => sample.lcpMs), 2_500),
    cls: summarizeSamples(measurements.map((sample) => sample.cls), 0.1),
    transferredKb: summarizeSamples(measurements.map((sample) => sample.transferredKb), 2_000),
  };
}

async function measureApi(
  page: Page,
  endpoint: { name: string; path: string; p95BudgetMs: number },
): Promise<ApiResult> {
  await page.request.get(`${baseUrl}${endpoint.path}`);

  const latencies: number[] = [];
  const responseSizes: number[] = [];
  const statusCounts: Record<string, number> = {};

  for (let offset = 0; offset < apiRuns; offset += apiConcurrency) {
    const batchSize = Math.min(apiConcurrency, apiRuns - offset);
    const batch = await Promise.all(Array.from({ length: batchSize }, async () => {
      const startedAt = performance.now();
      const response = await page.request.get(`${baseUrl}${endpoint.path}`);
      const body = await response.body();
      return {
        latency: performance.now() - startedAt,
        size: body.byteLength,
        status: response.status(),
      };
    }));

    for (const result of batch) {
      latencies.push(result.latency);
      responseSizes.push(result.size);
      statusCounts[result.status] = (statusCounts[result.status] ?? 0) + 1;
    }
  }

  const failed = Object.entries(statusCounts)
    .filter(([status]) => Number(status) >= 400)
    .reduce((total, [, count]) => total + count, 0);
  const errorRatePct = round((failed / apiRuns) * 100);
  const latencyMs = summarizeSamples(latencies, endpoint.p95BudgetMs);

  return {
    name: endpoint.name,
    path: endpoint.path,
    latencyMs,
    averageResponseKb: round(responseSizes.reduce((sum, size) => sum + size, 0) / responseSizes.length / 1024),
    statusCounts,
    errorRatePct,
    passed: latencyMs.passed && errorRatePct === 0,
  };
}

function reportHtml(report: {
  generatedAt: string;
  environment: string;
  pageResults: PageResult[];
  apiResults: ApiResult[];
  passed: boolean;
}) {
  const pageRows = report.pageResults.map((result) => `
    <tr><td><strong>${escapeHtml(result.route)}</strong></td><td>${result.navigationMs.p50}</td><td>${result.navigationMs.p95}</td><td>${result.ttfbMs.p95}</td><td>${result.lcpMs.p95}</td><td>${result.cls.p95}</td><td><span class="status ${result.navigationMs.passed && result.ttfbMs.passed && result.lcpMs.passed && result.cls.passed ? "pass" : "warn"}">${result.navigationMs.passed && result.ttfbMs.passed && result.lcpMs.passed && result.cls.passed ? "Within budget" : "Review"}</span></td></tr>`).join("");
  const apiRows = report.apiResults.map((result) => `
    <tr><td><strong>${escapeHtml(result.name)}</strong><small>${escapeHtml(result.path)}</small></td><td>${result.latencyMs.p50}</td><td>${result.latencyMs.p95}</td><td>${result.latencyMs.p99}</td><td>${result.averageResponseKb}</td><td>${result.errorRatePct}%</td><td><span class="status ${result.passed ? "pass" : "warn"}">${result.passed ? "Within budget" : "Review"}</span></td></tr>`).join("");

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Aelora performance baseline</title><style>
  :root{color-scheme:dark;font-family:Inter,Segoe UI,sans-serif;background:#0b0d10;color:#f5f7fb}*{box-sizing:border-box}body{margin:0;padding:38px;background:radial-gradient(circle at 8% 0%,#12304a 0,transparent 33%),#0b0d10}.wrap{max-width:1400px;margin:auto}.eyebrow{color:#64b5f6;font-weight:700;letter-spacing:.12em;text-transform:uppercase;font-size:12px}h1{font-size:38px;margin:8px 0 4px}p{color:#aab7c8;margin:0 0 22px}.summary{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin:24px 0}.card,section{border:1px solid #242b35;border-radius:18px;background:#11151a;box-shadow:0 18px 45px #0004}.card{padding:18px}.card strong{display:block;font-size:25px;margin-top:7px}.card span{color:#8f9cac;font-size:13px}section{padding:22px;margin-top:18px}h2{margin:0 0 15px;font-size:20px}table{width:100%;border-collapse:collapse;font-size:14px}th{text-align:left;color:#8f9cac;font-weight:600;padding:10px;border-bottom:1px solid #2a313b}td{padding:13px 10px;border-bottom:1px solid #1e242c}small{display:block;color:#718096;margin-top:4px}.status{display:inline-block;padding:5px 9px;border-radius:999px;font-size:12px;font-weight:700}.pass{background:#0b3b2b;color:#6ee7b7}.warn{background:#493115;color:#fbbf24}.foot{margin-top:18px;font-size:12px;color:#718096}
  </style></head><body><main class="wrap"><div class="eyebrow">Chapter 7 · Performance testing evidence</div><h1>Aelora performance baseline</h1><p>Authenticated local benchmark · ${escapeHtml(report.generatedAt)} · ${escapeHtml(report.environment)}</p><div class="summary"><div class="card"><span>Overall gate</span><strong>${report.passed ? "PASS" : "REVIEW"}</strong></div><div class="card"><span>Page samples</span><strong>${pageRuns} × ${report.pageResults.length}</strong></div><div class="card"><span>API samples</span><strong>${apiRuns} × ${report.apiResults.length}</strong></div><div class="card"><span>API concurrency</span><strong>${apiConcurrency}</strong></div></div><section><h2>User-interface navigation</h2><table><thead><tr><th>Route</th><th>Median (ms)</th><th>P95 nav (ms)</th><th>P95 TTFB (ms)</th><th>P95 LCP (ms)</th><th>P95 CLS</th><th>Result</th></tr></thead><tbody>${pageRows}</tbody></table></section><section><h2>Authenticated API load</h2><table><thead><tr><th>Endpoint</th><th>Median (ms)</th><th>P95 (ms)</th><th>P99 (ms)</th><th>Avg KB</th><th>Error rate</th><th>Result</th></tr></thead><tbody>${apiRows}</tbody></table></section><p class="foot">Budgets: navigation and LCP ≤ 2,500 ms; TTFB ≤ 800 ms; CLS ≤ 0.10; endpoint-specific API P95 budget; zero HTTP errors. INP is not claimed because this repeatable run measures navigation and read APIs rather than a controlled interaction sequence.</p></main></body></html>`;
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required.");

  const database = new Client({ connectionString: databaseUrl });
  await database.connect();
  const latest = await database.query<{ id: string; latest_observation: Date | null }>(`
    SELECT site.id, MAX(reading."observedAt") AS latest_observation
    FROM "SolarSite" site
    INNER JOIN "User" owner ON owner.id = site."ownerId"
    LEFT JOIN "TelemetryReading" reading ON reading."siteId" = site.id
    WHERE owner.email = $1 AND site.status = 'ACTIVE'
    GROUP BY site.id
    ORDER BY site."createdAt" ASC
    LIMIT 1
  `, [process.env.SEED_USER_EMAIL ?? "user@aelora.local"]);
  await database.end();

  const site = latest.rows[0];
  if (!site) throw new Error("No active seeded site was found for the benchmark user.");
  const historyEnd = site.latest_observation ?? new Date();
  const historyStart = new Date(historyEnd.getTime() - 30 * 24 * 60 * 60 * 1000);
  const date = (value: Date) => value.toISOString().slice(0, 10);

  const browser = await chromium.launch({ headless: true, executablePath: browserExecutable });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const page = await context.newPage();
    await page.addInitScript(() => {
      const target = window as Window & { __aeloraVitals?: { lcp: number; cls: number } };
      target.__aeloraVitals = { lcp: 0, cls: 0 };
      new PerformanceObserver((entries) => {
        const latestEntry = entries.getEntries().at(-1);
        if (latestEntry && target.__aeloraVitals) target.__aeloraVitals.lcp = latestEntry.startTime;
      }).observe({ type: "largest-contentful-paint", buffered: true });
      new PerformanceObserver((entries) => {
        for (const entry of entries.getEntries()) {
          const shift = entry as PerformanceEntry & { value?: number; hadRecentInput?: boolean };
          if (!shift.hadRecentInput && target.__aeloraVitals) target.__aeloraVitals.cls += shift.value ?? 0;
        }
      }).observe({ type: "layout-shift", buffered: true });
    });

    await signIn(page);
    const routes = ["/dashboard", "/live-monitoring", "/ai-forecast", "/performance", "/historical-analytics"];
    const pageResults: PageResult[] = [];
    for (const route of routes) pageResults.push(await measurePage(page, route));

    const endpoints = [
      { name: "Latest telemetry", path: `/api/sites/${site.id}/telemetry/latest`, p95BudgetMs: 750 },
      { name: "30-day history", path: `/api/sites/${site.id}/telemetry?from=${date(historyStart)}&to=${date(historyEnd)}&grain=day`, p95BudgetMs: 1_500 },
      { name: "Latest AI forecast", path: `/api/sites/${site.id}/forecast/latest`, p95BudgetMs: 750 },
      { name: "Stored weather", path: `/api/sites/${site.id}/weather`, p95BudgetMs: 750 },
    ];
    const apiResults: ApiResult[] = [];
    for (const endpoint of endpoints) apiResults.push(await measureApi(page, endpoint));

    const report = {
      generatedAt: new Date().toISOString(),
      environment: `${process.platform} · Node ${process.version} · local Next.js development server`,
      pageResults,
      apiResults,
      passed: pageResults.every((result) => result.navigationMs.passed && result.ttfbMs.passed && result.lcpMs.passed && result.cls.passed)
        && apiResults.every((result) => result.passed),
    };

    fs.mkdirSync(outputDirectory, { recursive: true });
    fs.writeFileSync(path.join(outputDirectory, "performance-baseline.json"), `${JSON.stringify(report, null, 2)}\n`);
    fs.writeFileSync(path.join(outputDirectory, "performance-baseline.html"), reportHtml(report));
    process.stdout.write(`Performance baseline ${report.passed ? "passed" : "requires review"}. Report: ${path.join(outputDirectory, "performance-baseline.json")}\n`);
    if (!report.passed) process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

void main();
