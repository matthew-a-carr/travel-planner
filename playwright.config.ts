import { defineConfig, devices } from '@playwright/test';

/**
 * E2e tests run against a locally running Next.js server backed by a
 * throwaway PostgreSQL database managed by Testcontainers (Docker).
 *
 * globalSetup starts the container, runs migrations, seeds reference data,
 * creates a test user + session, and writes tests/e2e/fixtures/auth-state.json.
 * globalTeardown stops the container when the suite finishes.
 *
 * Run: pnpm test:e2e
 * CI:  requires Docker (available by default on ubuntu-latest GitHub Actions runners).
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false, // Serial — tests share DB state and have ordered dependencies
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [['html', { open: 'never' }], ['list']],

  globalSetup: './tests/e2e/setup/global.setup',
  globalTeardown: './tests/e2e/setup/global.teardown',

  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    // Authenticated tests use the session cookie written by globalSetup.
    // Tests that need to run as an unauthenticated user override this with:
    //   test.use({ storageState: { cookies: [], origins: [] } })
    storageState: 'tests/e2e/fixtures/auth-state.json',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // In CI: start the pre-built production server (app must be built before running tests).
  // POSTGRES_URL is injected via shell substitution from the file written by globalSetup —
  // process.env mutations in globalSetup don't propagate to the Playwright runner process
  // that spawns the webServer (Playwright v1.42+ runs globalSetup in a separate process).
  // Locally: start the dev server and reuse an already-running instance.
  webServer: {
    command: process.env.CI
      ? 'POSTGRES_URL=$(cat tests/e2e/fixtures/.postgres-url) pnpm start'
      : 'pnpm dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
