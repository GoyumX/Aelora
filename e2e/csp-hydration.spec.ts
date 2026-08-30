import { expect, test } from "@playwright/test";

const targetUrl = process.env.AELORA_E2E_TARGET ?? "/sign-in";

test("nonce CSP allows the production sign-in form to hydrate", async ({ page }) => {
  const cspErrors: string[] = [];

  page.on("console", (message) => {
    if (
      message.type() === "error" &&
      /content security policy|refused to (?:execute|load).*script/i.test(message.text())
    ) {
      cspErrors.push(message.text());
    }
  });

  const response = await page.goto(targetUrl, { waitUntil: "domcontentloaded" });

  expect(response?.status()).toBe(200);
  const responseBody = await response!.text();
  const serverScriptTags = responseBody.match(/<script\b[^>]*>/gi) ?? [];

  await expect(page.getByLabel("Email address")).toBeVisible();
  await expect(page.getByLabel("Password")).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();

  const hydrationState = await page.evaluate(() => ({
    fallbackVisible: Boolean(document.querySelector(".animate-pulse")),
    scripts: document.scripts.length,
  }));

  expect(hydrationState.fallbackVisible).toBe(false);
  expect(hydrationState.scripts).toBeGreaterThan(0);
  expect(serverScriptTags.length).toBeGreaterThan(0);
  expect(serverScriptTags.every((script) => /\snonce=(?:"[^"]+"|'[^']+')/i.test(script))).toBe(true);
  expect(cspErrors).toEqual([]);
});
