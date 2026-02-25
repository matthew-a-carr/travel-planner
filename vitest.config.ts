import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    projects: [
      {
        // Unit project — pure domain functions and architecture checks.
        // No Docker required; runs instantly.
        plugins: [tsconfigPaths()],
        test: {
          name: 'unit',
          environment: 'node',
          include: [
            'src/domain/**/*.test.ts',
            'src/__tests__/**/*.test.ts',
          ],
        },
      },
      {
        // Integration project — repository and use-case tests against real PostgreSQL.
        // Requires Docker. A shared Testcontainers instance is started by globalSetup.
        plugins: [tsconfigPaths()],
        test: {
          name: 'integration',
          environment: 'node',
          include: [
            'src/infrastructure/db/repositories/**/*.test.ts',
            'src/application/use-cases/**/*.test.ts',
          ],
          globalSetup: ['src/infrastructure/testing/global-setup.ts'],
        },
      },
    ],
  },
});
