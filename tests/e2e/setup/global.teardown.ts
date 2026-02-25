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

const FIXTURES_DIR = join(process.cwd(), 'tests/e2e/fixtures');
const CONTAINER_ID_FILE = join(FIXTURES_DIR, '.container-id');
const SERVER_PID_FILE = join(FIXTURES_DIR, '.server-pid');

export default async function globalTeardown(): Promise<void> {
  // ── 1. Stop the Next.js production server (CI only) ───────────────────────
  // globalSetup wrote the shell process-group leader PID so we can send
  // SIGTERM to the entire group (shell → pnpm → node) in one call.
  try {
    const serverPid = parseInt((await readFile(SERVER_PID_FILE, 'utf-8')).trim(), 10);
    console.log(`[e2e] Stopping Next.js server (PID: ${serverPid})…`);
    try {
      process.kill(-serverPid, 'SIGTERM');
    } catch {
      // Process already gone — no-op.
    }
    await unlink(SERVER_PID_FILE);
  } catch {
    // File doesn't exist (local dev mode, not CI) — nothing to do.
  }

  // ── 2. Stop the PostgreSQL container ──────────────────────────────────────
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
