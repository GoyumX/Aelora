import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { expect, test, type Page } from "@playwright/test";

const evidenceDirectory = path.resolve("docs/evidence/step-28-performance-and-database");

function evidencePath(filename: string) {
  return path.join(evidenceDirectory, filename);
}

async function signInAsSeededUser(page: Page) {
  const password = process.env.SEED_USER_PASSWORD;
  if (!password) throw new Error("SEED_USER_PASSWORD is required for performance evidence capture.");

  await page.goto("/sign-in");
  await page.getByLabel("Email address").fill(process.env.SEED_USER_EMAIL ?? "user@aelora.local");
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

test.describe.serial("Step 28 performance and database evidence", () => {
  test.beforeAll(() => {
    fs.mkdirSync(evidenceDirectory, { recursive: true });
    expect(fs.existsSync(evidencePath("performance-baseline.html"))).toBe(true);
    expect(fs.existsSync(evidencePath("database-performance-audit.html"))).toBe(true);
  });

  test("captures the benchmarked product views", async ({ page }) => {
    await page.addInitScript(() => window.localStorage.setItem("theme", "dark"));
    await page.setViewportSize({ width: 1440, height: 1000 });
    await signInAsSeededUser(page);

    await page.goto("/dashboard", { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { name: /Good |Dashboard|Welcome/i })).toBeVisible();
    await page.screenshot({ path: evidencePath("01-benchmarked-dashboard.png"), fullPage: true });

    await page.goto("/historical-analytics", { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { name: "Historical analytics" })).toBeVisible();
    await page.screenshot({ path: evidencePath("02-historical-analytics-under-test.png"), fullPage: true });

    await page.goto("/performance", { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { name: "Performance", exact: true })).toBeVisible();
    await page.screenshot({ path: evidencePath("03-panel-performance-under-test.png"), fullPage: true });

    await page.goto("/ai-forecast", { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { name: /AI forecast/i })).toBeVisible();
    await page.screenshot({ path: evidencePath("04-ai-forecast-under-test.png"), fullPage: true });
  });

  test("captures the generated performance and database reports", async ({ page }) => {
    await page.setViewportSize({ width: 1500, height: 1000 });

    await page.goto(pathToFileURL(evidencePath("performance-baseline.html")).href);
    await expect(page.getByRole("heading", { name: "Aelora performance baseline" })).toBeVisible();
    await page.screenshot({ path: evidencePath("05-performance-baseline-report.png"), fullPage: true });

    await page.goto(pathToFileURL(evidencePath("database-performance-audit.html")).href);
    await expect(page.getByRole("heading", { name: "PostgreSQL performance audit" })).toBeVisible();
    await page.screenshot({ path: evidencePath("06-postgresql-performance-audit.png"), fullPage: true });
  });

  test("captures the responsive dashboard test surface", async ({ page }) => {
    await page.addInitScript(() => window.localStorage.setItem("theme", "light"));
    await page.setViewportSize({ width: 390, height: 844 });
    await signInAsSeededUser(page);
    await page.goto("/dashboard", { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { name: /Good |Dashboard|Welcome/i })).toBeVisible();
    await page.screenshot({ path: evidencePath("07-responsive-dashboard.png"), fullPage: true });
  });
});
