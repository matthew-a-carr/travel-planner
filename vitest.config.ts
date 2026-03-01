import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    projects: [
      {
        // Unit project — pure domain functions and architecture checks.
        // Matches all *.test.ts files, excluding *.int-test.ts.
        // No Docker required; runs instantly.
        plugins: [tsconfigPaths()],
        test: {
          name: 'unit',
          environment: 'node',
          include: ['src/**/*.test.ts'],
          exclude: ['**/node_modules/**', 'src/**/*.int-test.ts'],
        },
      },
      {
        // Integration project — repository and use-case tests against real PostgreSQL.
        // Matches all *.int-test.ts files anywhere under src/.
        // Requires Docker. A shared Testcontainers instance is started by globalSetup.
        // Run serially in one worker because each file truncates shared tables in beforeEach.
        plugins: [tsconfigPaths()],
        test: {
          name: 'integration',
          environment: 'node',
          include: ['src/**/*.int-test.ts'],
          maxWorkers: 1,
          globalSetup: ['src/infrastructure/testing/global-setup.ts'],
        },
      },
    ],
  },
});
