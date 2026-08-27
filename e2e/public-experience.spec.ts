import fs from "node:fs";
import path from "node:path";

import { expect, test } from "@playwright/test";

const evidenceDirectory = path.resolve("docs/evidence/public-experience-redesign");

test.beforeAll(() => {
  fs.mkdirSync(evidenceDirectory, { recursive: true });
});

for (const viewport of [
  { name: "desktop", width: 1440, height: 1000 },
  { name: "mobile", width: 390, height: 844 },
]) {
  test(`landing page is coherent at ${viewport.name} size`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto("/", { waitUntil: "networkidle" });
    await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });

    await expect(page.getByRole("heading", { level: 1, name: /read the sun\. run the day\./i })).toBeVisible();
    await expect(page.getByRole("img", { name: "Today’s generation and household demand curve" })).toBeVisible();

    const pageStructure = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      h1Count: document.querySelectorAll("h1").length,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    expect(pageStructure.scrollWidth).toBeLessThanOrEqual(pageStructure.clientWidth);
    expect(pageStructure.h1Count).toBe(1);

    await page.screenshot({
      animations: "disabled",
      fullPage: true,
      path: path.join(evidenceDirectory, `landing-${viewport.name}.png`),
    });
  });

  test(`sign-in page is coherent at ${viewport.name} size`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto("/sign-in", { waitUntil: "networkidle" });
    await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });

    await expect(page.getByRole("heading", { level: 1, name: "Welcome back" })).toBeVisible();
    await expect(page.getByLabel("Email address")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();

    const pageStructure = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      h1Count: document.querySelectorAll("h1").length,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    expect(pageStructure.scrollWidth).toBeLessThanOrEqual(pageStructure.clientWidth);
    expect(pageStructure.h1Count).toBe(1);

    await page.screenshot({
      animations: "disabled",
      fullPage: true,
      path: path.join(evidenceDirectory, `sign-in-${viewport.name}.png`),
    });
  });
}
