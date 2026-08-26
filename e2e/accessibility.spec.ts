import fs from "node:fs";

import { expect, test, type BrowserContext, type Page } from "@playwright/test";

type AxeViolation = {
  id: string;
  impact: string | null;
  nodes: Array<{ target: string[] }>;
};

const publicRoutes = ["/", "/sign-in", "/sign-up", "/forgot-password"];
const protectedRoutes = [
  "/dashboard",
  "/live-monitoring",
  "/ai-forecast",
  "/performance",
  "/historical-analytics",
  "/alerts",
  "/reports",
  "/system-configuration",
  "/system-configuration/solar-panels",
  "/system-configuration/inverter",
  "/system-configuration/battery",
  "/settings",
  "/help",
];

const axeSource = fs.readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");

async function assertNoWcagViolations(page: Page, route: string) {
  await page.goto(route, { waitUntil: "networkidle" });
  await page.addScriptTag({ content: axeSource });

  const violations = await page.evaluate(async () => {
    const axe = (window as typeof window & {
      axe: { run: (root: Document, options: unknown) => Promise<{ violations: AxeViolation[] }> };
    }).axe;

    const result = await axe.run(document, {
      runOnly: {
        type: "tag",
        values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"],
      },
    });

    return result.violations.map(({ id, impact, nodes }) => ({
      id,
      impact,
      targets: nodes.map((node) => node.target),
    }));
  });

  expect(violations, `${route} should have no automated WCAG A/AA violations`).toEqual([]);
}

async function signInAsSeededUser(page: Page) {
  const password = process.env.SEED_USER_PASSWORD;
  if (!password) {
    throw new Error("SEED_USER_PASSWORD is required for protected accessibility tests.");
  }

  await page.goto("/sign-in");
  await page.getByLabel("Email address").fill(process.env.SEED_USER_EMAIL ?? "user@aelora.local");
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

async function signInAsSeededAdmin(page: Page) {
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!password) {
    throw new Error("SEED_ADMIN_PASSWORD is required for admin accessibility tests.");
  }

  await page.goto("/sign-in");
  await page.getByLabel("Email address").fill(process.env.SEED_ADMIN_EMAIL ?? "admin@aelora.local");
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

test.describe("public accessibility", () => {
  for (const route of publicRoutes) {
    test(`${route} has no automated WCAG A/AA violations`, async ({ page }) => {
      await assertNoWcagViolations(page, route);
    });
  }

  test("validation identifies and focuses the invalid sign-in field", async ({ page }) => {
    await page.goto("/sign-in");
    await page.getByRole("button", { name: "Sign in" }).click();

    const email = page.getByLabel("Email address");
    const error = page.locator("#sign-in-error");
    await expect(email).toBeFocused();
    await expect(email).toHaveAttribute("aria-invalid", "true");
    await expect(email).toHaveAttribute("aria-describedby", "sign-in-error");
    await expect(error).toHaveAttribute("role", "alert");
    await expect(error).toHaveAttribute("id", "sign-in-error");
  });
});

test.describe.serial("protected accessibility and reflow", () => {
  let context: BrowserContext;
  let protectedPage: Page;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    protectedPage = await context.newPage();
    await signInAsSeededUser(protectedPage);
  });

  test.afterAll(async () => {
    await context.close();
  });

  for (const route of protectedRoutes) {
    test(`${route} passes automated WCAG checks and mobile reflow`, async () => {
      await protectedPage.setViewportSize({ width: 375, height: 812 });
      await assertNoWcagViolations(protectedPage, route);

      const pageStructure = await protectedPage.evaluate(() => ({
        clientWidth: document.documentElement.clientWidth,
        h1Count: document.querySelectorAll("h1").length,
        scrollWidth: document.documentElement.scrollWidth,
        title: document.title,
      }));

      expect(pageStructure.scrollWidth).toBeLessThanOrEqual(pageStructure.clientWidth);
      expect(pageStructure.h1Count).toBe(1);
      expect(pageStructure.title).not.toBe("Aelora");
    });
  }

  test("dashboard reflows at three breakpoints and remains accessible in dark mode", async ({}, testInfo) => {
    for (const viewport of [
      { name: "mobile", width: 375, height: 812 },
      { name: "tablet", width: 768, height: 1024 },
      { name: "desktop", width: 1440, height: 1000 },
    ]) {
      await protectedPage.setViewportSize({ width: viewport.width, height: viewport.height });
      await protectedPage.goto("/dashboard", { waitUntil: "networkidle" });

      const dimensions = await protectedPage.evaluate(() => ({
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
      }));
      expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);

      await testInfo.attach(`dashboard-${viewport.name}`, {
        body: await protectedPage.screenshot({ fullPage: true }),
        contentType: "image/png",
      });
    }

    await protectedPage.getByRole("button", { name: "Change color theme" }).click();
    await protectedPage.getByRole("menuitem", { name: "Dark" }).click();
    await expect(protectedPage.locator("html")).toHaveClass(/dark/);
    await assertNoWcagViolations(protectedPage, "/dashboard");
  });

  test("skip link moves keyboard focus to the main content", async () => {
    await protectedPage.goto("/dashboard");
    await protectedPage.keyboard.press("Tab");
    const skipLink = protectedPage.getByRole("link", { name: "Skip to main content" });
    await expect(skipLink).toBeFocused();
    await skipLink.press("Enter");
    await expect(protectedPage.locator("#main-content")).toBeFocused();
  });

  test("site and user dropdown menus open without a Base UI context error", async () => {
    await protectedPage.goto("/dashboard");

    await protectedPage.getByRole("button", { name: "Select solar site" }).click();
    await expect(protectedPage.getByText("Solar sites")).toBeVisible();
    await protectedPage.keyboard.press("Escape");

    await protectedPage.getByRole("button", { name: "Open user menu" }).click();
    const profileSettings = protectedPage.getByRole("menuitem", { name: "Profile settings" });
    await expect(profileSettings).toBeVisible();
    await expect(protectedPage.getByRole("menuitem", { name: "Sign out" })).toBeVisible();
    await profileSettings.click();
    await expect(protectedPage).toHaveURL(/\/settings#profile$/);
    await expect(protectedPage.getByRole("heading", { name: "Profile" })).toBeVisible();
  });
});

test.describe("admin accessibility and reflow", () => {
  test("admin console passes automated WCAG checks and mobile reflow", async ({ page }) => {
    await signInAsSeededAdmin(page);
    await page.setViewportSize({ width: 375, height: 812 });
    await assertNoWcagViolations(page, "/admin");

    const pageStructure = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      h1Count: document.querySelectorAll("h1").length,
      scrollWidth: document.documentElement.scrollWidth,
      title: document.title,
    }));

    expect(pageStructure.scrollWidth).toBeLessThanOrEqual(pageStructure.clientWidth);
    expect(pageStructure.h1Count).toBe(1);
    expect(pageStructure.title).toBe("Admin console | Aelora");
  });
});
