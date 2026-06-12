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
 * Ctrl-C stops Metro and shuts the backend down with escalation
 * (SIGINT → SIGTERM → SIGKILL on its process group), then sweeps the
 * labelled dev Postgres container — the web dev script's own cleanup
 * doesn't survive its process being killed.
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

/**
 * A TCP answer on port 3000 is not enough — a leftover `next dev` whose
 * Testcontainers Postgres has since died still serves pages but 500s on
 * every DB-touching request (bit us on 2026-06-12: sign-in failed with
 * ECONNREFUSED against a long-gone container port). There's no /health
 * endpoint yet, so probe the one unauthenticated route that reaches the
 * DB when given a valid-shaped body: /api/v1/auth/mobile/start (the
 * rate-limit check queries Postgres before anything else). 2xx/4xx →
 * process AND database alive; 5xx/network → unhealthy.
 */
async function backendHealthy(origin) {
  try {
    const response = await fetch(`${origin}/api/v1/auth/mobile/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code_challenge: 'devmobile-health-probe-'.padEnd(43, 'x') }),
      signal: AbortSignal.timeout(5_000),
    });
    return response.status < 500;
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
    if ((await isServing(url)) && (await backendHealthy(url))) return;
    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }
  throw new Error(`backend did not answer on ${url} within ${BACKEND_BOOT_TIMEOUT_MS / 1000}s`);
}

function dockerOutput(args) {
  return new Promise((resolve) => {
    const child = spawn('docker', args, { stdio: ['ignore', 'pipe', 'ignore'] });
    let output = '';
    child.stdout?.on('data', (chunk) => {
      output += chunk.toString();
    });
    child.on('error', () => resolve(null));
    child.on('close', (code) => resolve(code === 0 ? output.trim() : null));
  });
}

/**
 * The web dev script's own container cleanup lives in a `finally` that
 * never runs when tsx is killed by the shutdown signals, so the
 * orchestrator sweeps the labelled dev container itself (same label
 * filter `apps/web/scripts/dev.ts` uses for its boot-time stale sweep).
 */
async function removeLeftoverDevContainers() {
  const ids = await dockerOutput([
    'ps',
    '-q',
    '--filter',
    'label=travel-planner.dev=pnpm-dev',
  ]);
  if (!ids) return;
  const list = ids.split('\n').filter(Boolean);
  for (const id of list) {
    await dockerOutput(['rm', '-f', id]);
  }
  console.log(`[dev:mobile] Removed ${list.length} leftover dev Postgres container(s).`);
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

  const localOrigin = `http://127.0.0.1:${BACKEND_PORT}`;
  if (!targetsLocalBackend) {
    console.log('[dev:mobile] Remote base URL — skipping the local backend.');
  } else if (await isServing(localOrigin)) {
    if (!(await backendHealthy(localOrigin))) {
      // Fail loud: reusing a zombie produces "sign-in failed [internal]"
      // on the phone with the real error buried in server logs.
      throw new Error(
        `something is serving port ${BACKEND_PORT} but its database is unreachable ` +
          `(likely a leftover dev server whose Postgres container is gone). Kill it ` +
          `(lsof -nP -iTCP:${BACKEND_PORT} -sTCP:LISTEN, then kill <pid>) and re-run pnpm dev:mobile.`,
      );
    }
    console.log(`[dev:mobile] Port ${BACKEND_PORT} already serving and healthy — reusing it.`);
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

  // Shutdown must be escalation, not hope: pnpm/tsx/next don't reliably
  // die from one polite signal (a survived `next dev` is exactly the
  // zombie the health probe above exists to catch). SIGINT first so the
  // web dev script's container cleanup runs, then SIGTERM, then SIGKILL
  // the whole group. Idempotent — both Ctrl-C and metro-exit funnel here.
  let backendShutdown = null;
  const shutdownBackend = () => {
    if (!backend) return Promise.resolve();
    if (backendShutdown) return backendShutdown;
    const child = backend;
    backendShutdown = (async () => {
      const closed = new Promise((resolve) => {
        if (child.exitCode !== null) resolve(undefined);
        else child.once('close', () => resolve(undefined));
      });
      const closedWithin = (ms) =>
        Promise.race([
          closed.then(() => true),
          new Promise((resolve) => setTimeout(() => resolve(false), ms)),
        ]);

      killProcessGroup(child, 'SIGINT');
      if (await closedWithin(8_000)) return;
      killProcessGroup(child, 'SIGTERM');
      if (await closedWithin(8_000)) return;
      console.log('[dev:mobile] Backend ignored SIGINT/SIGTERM — force-killing its process group.');
      killProcessGroup(child, 'SIGKILL');
      await closedWithin(2_000);
    })();
    return backendShutdown;
  };
  process.once('SIGINT', () => {
    void shutdownBackend();
  });
  process.once('SIGTERM', () => {
    void shutdownBackend();
  });

  const exitCode = await new Promise((resolve, reject) => {
    metro.on('error', reject);
    metro.on('close', (code) => resolve(code ?? 1));
  });

  await shutdownBackend();
  if (backend) await removeLeftoverDevContainers();

  // Insurance: if anything escaped the process group, say so loudly
  // rather than leaving a silent zombie on port 3000.
  if (backend && (await isServing(localOrigin))) {
    console.error(
      `[dev:mobile] WARNING: port ${BACKEND_PORT} is still serving after shutdown — ` +
        `find it with: lsof -nP -iTCP:${BACKEND_PORT} -sTCP:LISTEN`,
    );
  }

  process.exitCode = exitCode;
}

main().catch((error) => {
  console.error(`[dev:mobile] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
