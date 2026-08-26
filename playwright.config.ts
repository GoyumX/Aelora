import "dotenv/config";

import { defineConfig, devices } from "@playwright/test";

const windowsChrome = "C:/Program Files/Google/Chrome/Application/chrome.exe";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  // Evidence suites share a seeded account and write canonical screenshots.
  // A single worker keeps authentication state and evidence writes deterministic.
  workers: 1,
  // Development-server route compilation can exceed Playwright's 5 s default
  // on the first authenticated navigation on Windows.
  expect: { timeout: 15_000 },
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
    ...devices["Desktop Chrome"],
    launchOptions: {
      executablePath:
        process.env.PLAYWRIGHT_EXECUTABLE_PATH ??
        (process.platform === "win32" ? windowsChrome : undefined),
    },
  },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000/sign-in",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
