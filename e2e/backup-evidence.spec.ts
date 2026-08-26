import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { expect, test } from "@playwright/test";

const evidenceDirectory = path.resolve("docs/evidence/step-29-backup-and-retention");

function evidencePath(filename: string) {
  return path.join(evidenceDirectory, filename);
}

test.describe.serial("Step 29 backup and retention evidence", () => {
  test.beforeAll(() => {
    fs.mkdirSync(evidenceDirectory, { recursive: true });
    expect(fs.existsSync(evidencePath("backup-restore-verification.html"))).toBe(true);
    expect(fs.existsSync(evidencePath("retention-readiness.html"))).toBe(true);
  });

  test("captures the passing PostgreSQL recovery proof", async ({ page }) => {
    await page.setViewportSize({ width: 1500, height: 1000 });
    await page.goto(pathToFileURL(evidencePath("backup-restore-verification.html")).href);
    await expect(page.getByRole("heading", { name: "PostgreSQL backup & restore proof" })).toBeVisible();
    await expect(page.getByText("PASS", { exact: true })).toBeVisible();
    await page.screenshot({ path: evidencePath("01-backup-restore-proof.png"), fullPage: true });
  });

  test("captures current fail-closed retention prerequisites", async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 1000 });
    await page.goto(pathToFileURL(evidencePath("retention-readiness.html")).href);
    await expect(page.getByRole("heading", { name: "Telemetry retention readiness" })).toBeVisible();
    await expect(page.getByText(/SAFELY BLOCKED|ALLOWED/, { exact: true })).toBeVisible();
    await page.screenshot({ path: evidencePath("02-retention-readiness.png"), fullPage: true });
  });
});
