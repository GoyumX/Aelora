import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { expect, test, type Page } from "@playwright/test";

const evidenceDirectory = path.resolve("docs/evidence/step-30-telemetry-rollups");
const evidencePath = (filename: string) => path.join(evidenceDirectory, filename);

async function signInAsSeededUser(page: Page) {
  const password = process.env.SEED_USER_PASSWORD;
  if (!password) throw new Error("SEED_USER_PASSWORD is required for roll-up evidence capture.");
  await page.goto("/sign-in");
  await page.getByLabel("Email address").fill(process.env.SEED_USER_EMAIL ?? "user@aelora.local");
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Dashboard", exact: true })).toBeVisible({ timeout: 15_000 });
}

test.describe.serial("Step 30 telemetry roll-up evidence", () => {
  test.beforeAll(() => {
    expect(fs.existsSync(evidencePath("telemetry-rollup-verification.html"))).toBe(true);
    expect(fs.existsSync(evidencePath("retention-dry-run.html"))).toBe(true);
  });

  test("captures raw-to-daily PostgreSQL reconciliation", async ({ page }) => {
    await page.setViewportSize({ width: 1500, height: 950 });
    await page.goto(pathToFileURL(evidencePath("telemetry-rollup-verification.html")).href);
    await expect(page.getByRole("heading", { name: "Telemetry roll-up verification" })).toBeVisible();
    await expect(page.getByText("PASS", { exact: true }).first()).toBeVisible();
    await page.screenshot({ path: evidencePath("01-rollup-reconciliation.png"), fullPage: true });
  });

  test("captures the non-destructive retention preview", async ({ page }) => {
    await page.setViewportSize({ width: 1450, height: 950 });
    await page.goto(pathToFileURL(evidencePath("retention-dry-run.html")).href);
    await expect(page.getByRole("heading", { name: "Raw telemetry retention dry-run" })).toBeVisible();
    await expect(page.getByText("READY", { exact: true })).toBeVisible();
    await expect(page.getByText(/No DELETE statement exists/)).toBeVisible();
    await page.screenshot({ path: evidencePath("02-retention-dry-run.png"), fullPage: true });
  });

  test("captures Historical Analytics reading reconciled daily summaries", async ({ page }) => {
    await page.addInitScript(() => window.localStorage.setItem("theme", "dark"));
    await page.setViewportSize({ width: 1500, height: 1000 });
    await signInAsSeededUser(page);
    await page.goto("/historical-analytics?range=30&grain=day", { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { name: "Historical analytics" })).toBeVisible();
    await expect(page.getByText(/reconciled daily summaries/)).toBeVisible();
    await page.screenshot({ path: evidencePath("03-historical-analytics-rollups.png"), fullPage: true });
  });
});
