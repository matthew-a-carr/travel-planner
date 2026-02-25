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

  // In CI: globalSetup starts the pre-built production server directly — after
  // Testcontainers has written the real POSTGRES_URL into process.env.  Playwright's
  // webServer plugin spawns the command *before* globalSetup runs, so it would
  // capture an empty POSTGRES_URL and cause next start to crash.  By managing the
  // server lifecycle inside globalSetup/globalTeardown we guarantee the correct
  // startup order: container → env → server.
  //
  // Locally: start the dev server and reuse an already-running instance.
  ...(process.env.CI
    ? {}
    : {
        webServer: {
          command: 'pnpm dev',
          url: 'http://localhost:3000',
          reuseExistingServer: true,
          timeout: 120_000,
        },
      }),
});
