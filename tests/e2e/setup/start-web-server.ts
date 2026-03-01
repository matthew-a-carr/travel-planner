import { mkdir, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import {
  E2E_CONTAINER_ID_FILE,
  E2E_FIXTURES_DIR,
  E2E_POSTGRES_URL_FILE,
} from './e2e-env';

const PNPM_COMMAND = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';

async function main(): Promise<void> {
  const serverScript = process.env.CI ? 'start' : 'dev:next';
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
