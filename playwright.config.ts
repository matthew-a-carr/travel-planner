import { defineConfig, devices } from '@playwright/test';

/**
 * E2e tests run against a locally running Next.js dev server.
 * They require a real Postgres database and valid OAuth session.
 *
 * Run: pnpm test:e2e
 * CI: skipped by default (requires DB + auth setup)
 *
 * To run against a specific URL, set BASE_URL env var.
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false, // Serial — tests share DB state
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [['html', { open: 'never' }], ['list']],
  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // In CI: start the pre-built production server (app must be built before running tests).
  // Locally: start the dev server and reuse an already-running instance.
  webServer: {
    command: process.env.CI ? 'pnpm start' : 'pnpm dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
