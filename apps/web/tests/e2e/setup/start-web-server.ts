import { mkdir, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import {
  E2E_CONTAINER_ID_FILE,
  E2E_FIXTURES_DIR,
  E2E_POSTGRES_URL_FILE,
} from './e2e-env';

const PNPM_COMMAND = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const E2E_DEFAULT_AUTH_SECRET = 'dev-only-not-a-real-secret';

async function main(): Promise<void> {
  // Always use the production server — E2E tests should exercise the same
  // code path as production.  Run `pnpm build` before `pnpm test:e2e`.
  const serverScript = 'start';
  let startedContainer: Awaited<ReturnType<PostgreSqlContainer['start']>> | null = null;

  try {
    await mkdir(E2E_FIXTURES_DIR, { recursive: true });

    startedContainer = await new PostgreSqlContainer('postgres:16-alpine')
      .withDatabase('travel_planner_test')
      .withUsername('testuser')
      .withPassword('testpass')
      .start();

    const postgresUrl = startedContainer.getConnectionUri();
    await writeFile(E2E_CONTAINER_ID_FILE, startedContainer.getId());
    await writeFile(E2E_POSTGRES_URL_FILE, postgresUrl);

    const child = spawn(PNPM_COMMAND, [serverScript], {
      env: {
        ...process.env,
        POSTGRES_URL: postgresUrl,
        AUTH_SECRET: process.env.AUTH_SECRET ?? E2E_DEFAULT_AUTH_SECRET,
        // Stable test-only key so /api/v1/* bearer endpoints boot in
        // production-mode e2e (per SPEC-002 step 1). Slice 2 e2e only
        // exercises the cookie path; the bearer integration tests cover
        // verification.
        AUTH_JWT_SIGNING_KEY:
          process.env.AUTH_JWT_SIGNING_KEY ?? 'e2e-only-jwt-signing-key-do-not-use-in-prod',
        // Provide dummy OAuth credentials so the sign-in button renders in
        // production mode (pnpm start).  The values must NOT start with a
        // known placeholder prefix (see provider-availability.ts).
        AUTH_GOOGLE_ID: process.env.AUTH_GOOGLE_ID ?? 'e2e-placeholder-client-id',
        AUTH_GOOGLE_SECRET: process.env.AUTH_GOOGLE_SECRET ?? 'e2e-placeholder-client-secret',
        AUTH_URL: process.env.AUTH_URL ?? 'http://localhost:3000',
      },
      stdio: 'inherit',
    });

    await new Promise<void>((resolve, reject) => {
      child.on('error', reject);
      child.on('close', (code) => {
        if (code === 0) {
          resolve();
          return;
        }
        reject(new Error(`pnpm ${serverScript} exited with code ${code ?? 'unknown'}`));
      });
    });
  } catch (error) {
    if (startedContainer) {
      await startedContainer.stop();
    }
    throw error;
  }
}

void main();
