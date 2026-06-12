/**
 * One-command mobile dev loop: `pnpm dev:mobile` from the repo root.
 *
 * Physical-iPhone Expo Go sessions used to need two terminals and a
 * hand-typed LAN IP (`pnpm dev` + `EXPO_PUBLIC_API_BASE_URL=http://<ip>:3000
 * pnpm dev:mobile`) — and forgetting the env var made every API call fail
 * with a synthetic `internal` ("Could not reach the server"), because the
 * app's default base URL is localhost, which on a phone is the phone.
 *
 * This script:
 *   1. Resolves the API base URL — an explicit `EXPO_PUBLIC_API_BASE_URL`
 *      wins (point it at prod to skip the local stack entirely); otherwise
 *      the Mac's LAN IPv4 on port 3000, so both the Simulator and a real
 *      device can reach the backend.
 *   2. Boots the backend (`pnpm --filter @travel-planner/web dev` — the
 *      full Testcontainers + migrate + seed bootstrap) unless something is
 *      already serving on port 3000, and waits for it to answer.
 *   3. Starts Metro (`expo start`) with the env var inlined.
 *
 * Ctrl-C stops Metro and forwards the signal to the backend's process
 * group so the web dev script's own container cleanup runs.
 *
 * `node apps/mobile/scripts/dev.mjs --print-url` prints the resolved base
 * URL and exits — handy when debugging device connectivity.
 */

import { spawn } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const PNPM_COMMAND = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const MOBILE_DIR = path.join(REPO_ROOT, 'apps/mobile');
const BACKEND_PORT = 3000;
const BACKEND_BOOT_TIMEOUT_MS = 240_000; // Testcontainers pull + migrate + seed on a cold start

function detectLanIpv4() {
  const interfaces = os.networkInterfaces();
  const candidates = [];
  for (const [name, addresses] of Object.entries(interfaces)) {
    for (const address of addresses ?? []) {
      if (address.family === 'IPv4' && !address.internal) {
        candidates.push({ name, address: address.address });
      }
    }
  }
  // Prefer the primary macOS interfaces; otherwise take the first real one.
  for (const preferred of ['en0', 'en1']) {
    const hit = candidates.find((candidate) => candidate.name === preferred);
    if (hit) return hit.address;
  }
  return candidates[0]?.address ?? null;
}

function resolveBaseUrl() {
  const explicit = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (explicit) return { url: explicit, source: 'env (EXPO_PUBLIC_API_BASE_URL)' };

  const lanIp = detectLanIpv4();
  if (lanIp) return { url: `http://${lanIp}:${BACKEND_PORT}`, source: `LAN IPv4 (${lanIp})` };

  // No network — Simulator-only fallback; a physical device won't reach this.
  return { url: `http://localhost:${BACKEND_PORT}`, source: 'fallback (no LAN interface found)' };
}

async function isServing(url) {
  try {
    await fetch(url, { signal: AbortSignal.timeout(1_500) });
    return true;
  } catch {
    return false;
  }
}

async function waitForBackend(url, backend) {
  const deadline = Date.now() + BACKEND_BOOT_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (backend.exitCode !== null) {
      throw new Error(`backend exited with code ${backend.exitCode} before serving`);
    }
    if (await isServing(url)) return;
    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }
  throw new Error(`backend did not answer on ${url} within ${BACKEND_BOOT_TIMEOUT_MS / 1000}s`);
}

function killProcessGroup(child, signal) {
  if (child.pid === undefined || child.exitCode !== null) return;
  try {
    process.kill(-child.pid, signal); // negative pid → the whole detached group
  } catch {
    child.kill(signal);
  }
}

async function main() {
  const { url: baseUrl, source } = resolveBaseUrl();
  console.log(`[dev:mobile] API base URL: ${baseUrl} — ${source}`);

  if (process.argv.includes('--print-url')) return;

  // Only manage a local backend when the target is this machine's port —
  // an explicit remote URL (e.g. prod) means Metro-only.
  const targetsLocalBackend = new URL(baseUrl).port === String(BACKEND_PORT);
  let backend = null;

  if (!targetsLocalBackend) {
    console.log('[dev:mobile] Remote base URL — skipping the local backend.');
  } else if (await isServing(`http://127.0.0.1:${BACKEND_PORT}`)) {
    console.log(`[dev:mobile] Port ${BACKEND_PORT} already serving — reusing it.`);
  } else {
    console.log('[dev:mobile] Starting the backend (pnpm dev: Postgres + migrate + seed)…');
    backend = spawn(PNPM_COMMAND, ['--filter', '@travel-planner/web', 'dev'], {
      cwd: REPO_ROOT,
      stdio: ['ignore', 'inherit', 'inherit'],
      detached: true, // own process group, so Metro's Ctrl-C doesn't orphan-kill it mid-cleanup
    });
    await waitForBackend(`http://127.0.0.1:${BACKEND_PORT}`, backend);
    console.log('[dev:mobile] Backend is up.');
  }

  console.log('[dev:mobile] Starting Metro (expo start)…');
  const metro = spawn(PNPM_COMMAND, ['exec', 'expo', 'start'], {
    cwd: MOBILE_DIR,
    env: { ...process.env, EXPO_PUBLIC_API_BASE_URL: baseUrl },
    stdio: 'inherit',
  });

  const stopBackend = (signal) => {
    if (backend) killProcessGroup(backend, signal);
  };
  process.once('SIGINT', () => stopBackend('SIGINT'));
  process.once('SIGTERM', () => stopBackend('SIGTERM'));

  const exitCode = await new Promise((resolve, reject) => {
    metro.on('error', reject);
    metro.on('close', (code) => resolve(code ?? 1));
  });

  // Metro is done — wind the backend down and give its container cleanup a beat.
  if (backend && backend.exitCode === null) {
    stopBackend('SIGTERM');
    await new Promise((resolve) => {
      const timer = setTimeout(resolve, 15_000);
      backend.once('close', () => {
        clearTimeout(timer);
        resolve(undefined);
      });
    });
  }

  process.exitCode = exitCode;
}

main().catch((error) => {
  console.error(`[dev:mobile] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
