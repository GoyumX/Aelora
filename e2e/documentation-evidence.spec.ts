import fs from "node:fs";
import path from "node:path";

import { expect, test, type Page } from "@playwright/test";

const evidenceDirectory = path.resolve("docs/evidence/step-27-security-hardening");

function evidencePath(filename: string) {
  return path.join(evidenceDirectory, filename);
}

async function signInAsSeededUser(page: Page) {
  const password = process.env.SEED_USER_PASSWORD;
  if (!password) throw new Error("SEED_USER_PASSWORD is required for documentation evidence capture.");

  await page.goto("/sign-in");
  await page.getByLabel("Email address").fill(process.env.SEED_USER_EMAIL ?? "user@aelora.local");
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

test.describe.serial("Chapter 6 and 7 implementation evidence", () => {
  test.beforeAll(() => {
    fs.mkdirSync(evidenceDirectory, { recursive: true });
  });

  test("captures the public authentication boundary", async ({ page }) => {
    const response = await page.goto("/sign-in", { waitUntil: "networkidle" });

    expect(response?.status()).toBe(200);
    expect(response?.headers()["content-security-policy"]).toContain("nonce-");
    await expect(page.getByText("Welcome back", { exact: true })).toBeVisible();
    await page.screenshot({ path: evidencePath("01-secured-sign-in.png"), fullPage: true });
  });

  test("captures the protected dashboard and settings workspace", async ({ page }) => {
    await page.addInitScript(() => window.localStorage.setItem("theme", "light"));
    await signInAsSeededUser(page);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/dashboard", { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { name: /Good |Dashboard|Welcome/i })).toBeVisible();
    await page.screenshot({ path: evidencePath("02-protected-dashboard.png"), fullPage: true });

    await page.goto("/settings", { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
    await page.screenshot({ path: evidencePath("03-profile-and-security-settings.png"), fullPage: false });
  });

  test("captures the separately running virtual-site gateway", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("http://127.0.0.1:4100", { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { name: "Virtual solar plant control room" })).toBeVisible();
    await page.screenshot({ path: evidencePath("04-virtual-site-gateway.png"), fullPage: true });
  });
});
