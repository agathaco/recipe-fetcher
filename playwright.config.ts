import { config as loadEnv } from "dotenv";
import { defineConfig, devices } from "@playwright/test";

// E2E runs against the dev database (the DATABASE_URL in .env.local). Every test
// names its data with an "e2e-" prefix and global-teardown deletes anything
// matching, so a crashed run leaves at most one stray recipe. A dedicated Neon
// branch would be cleaner; this keeps setup to zero.
loadEnv({ path: ".env.local" });

if (!process.env.APP_PASSWORD || !process.env.DATABASE_URL) {
  throw new Error("E2E needs APP_PASSWORD and DATABASE_URL in .env.local");
}

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? "github" : "list",
  globalTeardown: "./e2e/global-teardown.ts",
  expect: { timeout: 10_000 },
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      // Use the installed Google Chrome. Playwright's bundled Chromium needs
      // macOS 13+; CI installs Chrome via `npx playwright install chrome`.
      use: { ...devices["Desktop Chrome"], channel: "chrome" },
    },
  ],
  webServer: {
    // Test the production build, not `next dev`: no per-route compile lag,
    // which is the usual source of E2E flake.
    command: "npm run build && npm run start",
    url: "http://localhost:3000/login",
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
