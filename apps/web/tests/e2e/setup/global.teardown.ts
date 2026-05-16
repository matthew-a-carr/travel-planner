/**
 * Playwright global teardown — stop the Testcontainers PostgreSQL container.
 *
 * Reads the container ID written by global.setup.ts and stops/removes
 * the Docker container. Testcontainers' Ryuk side-car also handles
 * cleanup automatically, so this is a belt-and-braces measure.
 */

import { exec } from 'node:child_process';
import { readFile, unlink } from 'node:fs/promises';
import { promisify } from 'node:util';
import { E2E_CONTAINER_ID_FILE, E2E_POSTGRES_URL_FILE } from './e2e-env';

const execAsync = promisify(exec);

export default async function globalTeardown(): Promise<void> {
  let containerId: string;
  try {
    containerId = (await readFile(E2E_CONTAINER_ID_FILE, 'utf-8')).trim();
  } catch {
    // Setup never wrote the file — nothing to clean up.
    return;
  }

  console.log(`[e2e] Stopping PostgreSQL container ${containerId}…`);
  try {
    await execAsync(`docker stop ${containerId}`);
    await execAsync(`docker rm ${containerId}`);
    console.log('[e2e] Container stopped and removed.');
  } catch {
    // Container already gone (Ryuk beat us to it) — that is fine.
    console.log('[e2e] Container already removed.');
  }

  try {
    await unlink(E2E_CONTAINER_ID_FILE);
  } catch {
    // File already gone — no-op.
  }

  try {
    await unlink(E2E_POSTGRES_URL_FILE);
  } catch {
    // File already gone — no-op.
  }
}
