/**
 * Playwright global teardown — stop the Testcontainers PostgreSQL container.
 *
 * Reads the container ID written by global.setup.ts and stops/removes
 * the Docker container. Testcontainers' Ryuk side-car also handles
 * cleanup automatically, so this is a belt-and-braces measure.
 */

import { exec } from 'node:child_process';
import { readFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

const CONTAINER_ID_FILE = join(process.cwd(), 'tests/e2e/fixtures/.container-id');

export default async function globalTeardown(): Promise<void> {
  let containerId: string;
  try {
    containerId = (await readFile(CONTAINER_ID_FILE, 'utf-8')).trim();
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
    await unlink(CONTAINER_ID_FILE);
  } catch {
    // File already gone — no-op.
  }
}
