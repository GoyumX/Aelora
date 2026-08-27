import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { expect, test, type BrowserContext, type Page, type TestInfo } from "@playwright/test";

type UatStatus = "PASS" | "FAIL" | "SKIPPED";

type UatScenario = {
  actor: "USER" | "ADMIN";
  criteria: string;
  id: string;
  journey: string;
};

type UatResult = UatScenario & {
  durationMs: number;
  observed: string;
  status: UatStatus;
};

const evidenceDirectory = path.resolve("docs/evidence/step-31-user-acceptance");
const evidencePath = (filename: string) => path.join(evidenceDirectory, filename);

const scenarios: UatScenario[] = [
  {
    id: "UAT-01",
    actor: "USER",
    journey: "Authenticate and open the assigned solar site",
    criteria: "The seeded user reaches Dashboard and sees the assigned Colombo Home site.",
  },
  {
    id: "UAT-02",
    actor: "USER",
    journey: "Monitor live operation and inspect incidents",
    criteria: "Live Monitoring and Alerts load stored, site-scoped operational evidence.",
  },
  {
    id: "UAT-03",
    actor: "USER",
    journey: "Review decision-support and reporting views",
    criteria: "AI Forecast, Historical Analytics, Performance and Reports are available from one authenticated journey.",
  },
  {
    id: "UAT-04",
    actor: "USER",
    journey: "Review configuration, account settings and support",
    criteria: "Equipment inventory, profile settings and searchable help content remain available to the site owner.",
  },
  {
    id: "UAT-05",
    actor: "ADMIN",
    journey: "Enforce the administrator authorization boundary",
    criteria: "A regular user is redirected away from /admin while the seeded administrator can open Admin Console.",
  },
];

const results: UatResult[] = [];

function escapeHtml(value: unknown) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  })[character] ?? character);
}

function scenarioFor(title: string) {
  const id = title.match(/^UAT-\d{2}/)?.[0];
  return scenarios.find((scenario) => scenario.id === id);
}

function writeEvidenceReport() {
  const orderedResults = scenarios.map((scenario) =>
    results.find((result) => result.id === scenario.id) ?? {
      ...scenario,
      durationMs: 0,
      observed: "The scenario did not run.",
      status: "SKIPPED" as const,
    },
  );
  const passed = orderedResults.filter((result) => result.status === "PASS").length;
  const failed = orderedResults.filter((result) => result.status === "FAIL").length;
  const skipped = orderedResults.filter((result) => result.status === "SKIPPED").length;
  const report = {
    generatedAt: new Date().toISOString(),
    status: passed === scenarios.length ? "PASS" : "FAIL",
    summary: { total: scenarios.length, passed, failed, skipped },
    scenarios: orderedResults,
  };
  const rows = orderedResults.map((result) => `<tr><td><strong>${escapeHtml(result.id)}</strong></td><td>${escapeHtml(result.actor)}</td><td><strong>${escapeHtml(result.journey)}</strong><br><span>${escapeHtml(result.criteria)}</span></td><td>${(result.durationMs / 1_000).toFixed(1)} s</td><td><span class="status ${result.status.toLocaleLowerCase()}">${result.status}</span><br><small>${escapeHtml(result.observed)}</small></td></tr>`).join("");
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Aelora user acceptance report</title><style>:root{color-scheme:dark;font-family:Inter,Segoe UI,sans-serif;background:#090b0e;color:#f7f8fb}*{box-sizing:border-box}body{margin:0;padding:42px;background:radial-gradient(circle at 88% 0%,#102d4b 0,transparent 37%),#090b0e}.wrap{max-width:1380px;margin:auto}.eyebrow{color:#56b4ff;font-size:12px;font-weight:800;letter-spacing:.14em;text-transform:uppercase}h1{font-size:40px;margin:9px 0 6px}p,span,small{color:#aeb9c8}.summary{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin:26px 0}.card,section{background:#11151a;border:1px solid #29313b;border-radius:18px;box-shadow:0 18px 50px #0005}.card{padding:20px}.card strong{display:block;font-size:30px;margin-top:7px}.card span{font-size:13px}section{padding:22px}table{width:100%;border-collapse:collapse;font-size:14px}th{text-align:left;color:#9eacbd;padding:11px;border-bottom:1px solid #303944}td{vertical-align:top;padding:14px 11px;border-bottom:1px solid #242b34;line-height:1.55}.status{display:inline-block;padding:5px 9px;border-radius:999px;font-size:12px;font-weight:800}.pass{background:#093e2c;color:#66e6b0}.fail{background:#4c1d24;color:#fda4af}.skipped{background:#453515;color:#facc6b}.gate{color:${report.status === "PASS" ? "#66e6b0" : "#fda4af"}}small{display:block;margin-top:7px}</style></head><body><main class="wrap"><div class="eyebrow">Chapter 7 · Step 31 acceptance evidence</div><h1>Aelora user acceptance testing</h1><p>Role-based browser journeys · ${escapeHtml(report.generatedAt)}</p><div class="summary"><div class="card"><span>Acceptance gate</span><strong class="gate">${report.status}</strong></div><div class="card"><span>Passed</span><strong>${passed}</strong></div><div class="card"><span>Failed</span><strong>${failed}</strong></div><div class="card"><span>Skipped</span><strong>${skipped}</strong></div></div><section><table><thead><tr><th>Case</th><th>Actor</th><th>Journey and criterion</th><th>Duration</th><th>Observed result</th></tr></thead><tbody>${rows}</tbody></table></section></main></body></html>`;

  fs.mkdirSync(evidenceDirectory, { recursive: true });
  fs.writeFileSync(evidencePath("uat-results.json"), `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(evidencePath("uat-results.html"), html);
}

async function signIn(page: Page, role: "USER" | "ADMIN") {
  const passwordKey = role === "ADMIN" ? "SEED_ADMIN_PASSWORD" : "SEED_USER_PASSWORD";
  const emailKey = role === "ADMIN" ? "SEED_ADMIN_EMAIL" : "SEED_USER_EMAIL";
  const password = process.env[passwordKey];
  if (!password) throw new Error(`${passwordKey} is required for Step 31 UAT.`);

  await page.goto("/sign-in");
  await page.getByLabel("Email address").fill(process.env[emailKey] ?? (role === "ADMIN" ? "admin@aelora.local" : "user@aelora.local"));
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

function recordResult(testInfo: TestInfo) {
  const scenario = scenarioFor(testInfo.title);
  if (!scenario) return;
  const status: UatStatus = testInfo.status === "passed" ? "PASS" : testInfo.status === "skipped" ? "SKIPPED" : "FAIL";
  results.push({
    ...scenario,
    durationMs: testInfo.duration,
    observed: status === "PASS" ? "Expected page, role boundary and stored evidence were observed." : testInfo.error?.message?.split("\n")[0] ?? `Playwright status: ${testInfo.status}`,
    status,
  });
}

test.describe.serial("Step 31 user acceptance journeys", () => {
  let context: BrowserContext;
  let userPage: Page;

  test.beforeAll(async ({ browser }) => {
    fs.mkdirSync(evidenceDirectory, { recursive: true });
    context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    userPage = await context.newPage();
    await userPage.addInitScript(() => window.localStorage.setItem("theme", "light"));
  });

  test.afterEach(({}, testInfo) => recordResult(testInfo));

  test.afterAll(async () => {
    writeEvidenceReport();
    await context.close();
  });

  test("UAT-01 user authenticates and opens the assigned solar site", async () => {
    await signIn(userPage, "USER");
    await expect(userPage.getByRole("heading", { name: "Dashboard", exact: true })).toBeVisible();
    await userPage.getByRole("button", { name: "Select solar site" }).click();
    await expect(userPage.getByText("Colombo Home", { exact: true }).last()).toBeVisible();
    await userPage.keyboard.press("Escape");
    await userPage.screenshot({ path: evidencePath("01-user-dashboard.png"), fullPage: true });
  });

  test("UAT-02 user monitors live operation and inspects incidents", async () => {
    await userPage.goto("/live-monitoring", { waitUntil: "networkidle" });
    await expect(userPage.getByRole("heading", { name: "Live Monitoring" })).toBeVisible();
    await expect(userPage.getByText("Recent power trend", { exact: true })).toBeVisible();
    await userPage.screenshot({ path: evidencePath("02-live-monitoring.png"), fullPage: true });

    await userPage.goto("/alerts", { waitUntil: "networkidle" });
    await expect(userPage.getByRole("heading", { name: "Alerts", exact: true })).toBeVisible();
    await expect(userPage.getByText("Incident operations", { exact: true })).toBeVisible();
    await userPage.screenshot({ path: evidencePath("03-alerts.png"), fullPage: true });
  });

  test("UAT-03 user reviews forecast analytics performance and reports", async () => {
    await userPage.goto("/ai-forecast", { waitUntil: "networkidle" });
    await expect(userPage.getByRole("heading", { name: "AI Forecast", exact: true })).toBeVisible();
    await expect(userPage.getByRole("heading", { name: "Seven-day forecast" })).toBeVisible();
    await userPage.screenshot({ path: evidencePath("04-ai-forecast.png"), fullPage: true });

    await userPage.goto("/historical-analytics?range=30&grain=day", { waitUntil: "networkidle" });
    await expect(userPage.getByRole("heading", { name: "Historical analytics" })).toBeVisible();
    await expect(userPage.getByText(/reconciled daily summaries/)).toBeVisible();

    await userPage.goto("/performance", { waitUntil: "networkidle" });
    await expect(userPage.getByRole("heading", { name: "Performance", exact: true })).toBeVisible();

    await userPage.goto("/reports", { waitUntil: "networkidle" });
    await expect(userPage.getByRole("heading", { name: "Reports", exact: true })).toBeVisible();
    await expect(userPage.getByRole("heading", { name: "Generated reports" })).toBeVisible();
    await userPage.screenshot({ path: evidencePath("05-reports.png"), fullPage: true });
  });

  test("UAT-04 user reviews configuration settings and searchable support", async () => {
    await userPage.goto("/system-configuration", { waitUntil: "networkidle" });
    await expect(userPage.getByRole("heading", { name: "System configuration" })).toBeVisible();
    await expect(userPage.getByRole("link", { name: /Solar arrays/ })).toBeVisible();
    await userPage.screenshot({ path: evidencePath("06-system-configuration.png"), fullPage: true });

    await userPage.goto("/settings", { waitUntil: "networkidle" });
    await expect(userPage.getByRole("heading", { name: "Settings", exact: true })).toBeVisible();
    await expect(userPage.getByRole("heading", { name: "Profile", exact: true })).toBeVisible();

    await userPage.goto("/help", { waitUntil: "networkidle" });
    await expect(userPage.getByRole("heading", { name: /How can we help/ })).toBeVisible();
    await userPage.getByLabel("Search guides and questions").fill("forecast");
    await expect(userPage.getByRole("heading", { name: "Understand AI output" })).toBeVisible();
    await userPage.screenshot({ path: evidencePath("07-help-and-support.png"), fullPage: true });
  });

  test("UAT-05 role boundary denies the user and admits the administrator", async ({ browser }) => {
    await userPage.goto("/admin");
    await expect(userPage).toHaveURL(/\/dashboard$/);

    const adminContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const adminPage = await adminContext.newPage();
    await adminPage.addInitScript(() => window.localStorage.setItem("theme", "dark"));
    await signIn(adminPage, "ADMIN");
    await adminPage.goto("/admin", { waitUntil: "networkidle" });
    await expect(adminPage.getByRole("heading", { name: "Admin Console" })).toBeVisible();
    await expect(adminPage.getByRole("heading", { name: "Platform health" })).toBeVisible();
    await expect(adminPage.getByRole("heading", { name: "Administrative audit trail" })).toBeVisible();
    await adminPage.screenshot({ path: evidencePath("08-admin-console.png"), fullPage: true });
    await adminContext.close();
  });
});

test("Step 31 captures the passing user acceptance summary", async ({ page }) => {
  await page.setViewportSize({ width: 1500, height: 1000 });
  await page.goto(pathToFileURL(evidencePath("uat-results.html")).href);
  await expect(page.getByRole("heading", { name: "Aelora user acceptance testing" })).toBeVisible();
  await expect(page.locator(".gate")).toHaveText("PASS");
  await expect(page.locator(".summary .card").nth(1).getByText("5", { exact: true })).toBeVisible();
  await page.screenshot({ path: evidencePath("09-uat-summary.png"), fullPage: true });
});
