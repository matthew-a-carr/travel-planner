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
  // Start Next.js dev server automatically when running e2e tests locally
  webServer: process.env.CI
    ? undefined
    : {
        command: 'pnpm dev',
        url: 'http://localhost:3000',
        reuseExistingServer: true,
        timeout: 60_000,
      },
});
