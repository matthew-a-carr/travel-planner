/**
 * Playwright global setup — Testcontainers-backed PostgreSQL.
 *
 * Responsibilities:
 *  1. Start a throwaway PostgreSQL 16 container via Testcontainers.
 *  2. Expose the connection string to the process so Next.js
 *     picks it up when the web server is started by Playwright.
 *  3. Run Drizzle migrations against the fresh database.
 *  4. Seed country reference data.
 *  5. Create a test user + session and write a Playwright
 *     storage-state file (auth-state.json) so authenticated
 *     tests start with a valid session cookie.
 *  6. Persist the container ID to fixtures/.container-id so
 *     global.teardown.ts can stop it cleanly.
 *
 * The container is automatically reaped by Testcontainers' Ryuk
 * side-car even if teardown never runs (e.g. on a SIGKILL).
 */

import { spawn } from 'node:child_process';
import { openSync, closeSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { encode } from 'next-auth/jwt';
import postgres from 'postgres';
import { countryReferenceData, users } from '../../../src/infrastructure/db/schema';
import { COUNTRY_REFERENCE_SEED } from '../../../src/infrastructure/db/seed/country-reference-seed';

const FIXTURES_DIR = join(process.cwd(), 'tests/e2e/fixtures');
const CONTAINER_ID_FILE = join(FIXTURES_DIR, '.container-id');
const AUTH_STATE_FILE = join(FIXTURES_DIR, 'auth-state.json');
const SERVER_PID_FILE = join(FIXTURES_DIR, '.server-pid');

export default async function globalSetup(): Promise<void> {
  await mkdir(FIXTURES_DIR, { recursive: true });

  // ── 1. Start PostgreSQL container (or use existing POSTGRES_URL) ─────────
  let connectionUri: string;

  if (process.env.POSTGRES_URL) {
    // When POSTGRES_URL is already set (e.g. local dev with a running postgres
    // instance), skip Testcontainers entirely and use the provided URL.
    connectionUri = process.env.POSTGRES_URL;
    console.log(`[e2e] Using existing PostgreSQL at ${connectionUri}`);
  } else {
    console.log('[e2e] Starting PostgreSQL container…');
    const container = await new PostgreSqlContainer('postgres:16-alpine')
      .withDatabase('travel_planner_test')
      .withUsername('testuser')
      .withPassword('testpass')
      .start();

    connectionUri = container.getConnectionUri();

    // Persist the container ID for globalTeardown.
    await writeFile(CONTAINER_ID_FILE, container.getId());

    // Make the URL available to the Next.js web server that Playwright
    // will spawn after globalSetup completes.
    process.env.POSTGRES_URL = connectionUri;
    console.log(`[e2e] PostgreSQL ready at ${connectionUri}`);
  }

  // ── 2. Run migrations ──────────────────────────────────────────────────────
  const sql = postgres(connectionUri, { max: 1 });
  const db = drizzle(sql);

  console.log('[e2e] Running database migrations…');
  await migrate(db, { migrationsFolder: './drizzle' });
  console.log('[e2e] Migrations complete.');

  // ── 3. Seed country reference data ─────────────────────────────────────────
  console.log('[e2e] Seeding country reference data…');
  for (const row of COUNTRY_REFERENCE_SEED) {
    await db
      .insert(countryReferenceData)
      .values({ ...row, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: countryReferenceData.country,
        set: {
          avgDailyCostPence: row.avgDailyCostPence,
          currency: row.currency,
          source: row.source,
          updatedAt: new Date(),
        },
      });
  }
  console.log('[e2e] Country reference data seeded.');

  // ── 4. Create test user ─────────────────────────────────────────────────────
  const userId = crypto.randomUUID();
  await db.insert(users).values({
    id: userId,
    name: 'E2E Test User',
    email: 'e2e@travelplanner.test',
    emailVerified: null,
    image: null,
  });

  await sql.end();

  // ── 5. Create signed JWT for storage state ─────────────────────────────────
  // NextAuth v5 uses JWT strategy (session: { strategy: 'jwt' }).  The cookie
  // must contain a JOSE-encrypted JWT signed with AUTH_SECRET, not a raw UUID.
  const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
  const authSecret = process.env.AUTH_SECRET;
  if (!authSecret) throw new Error('[e2e] AUTH_SECRET must be set for JWT encoding');

  const cookieName = 'authjs.session-token';
  const jwt = await encode({
    token: {
      sub: userId,
      name: 'E2E Test User',
      email: 'e2e@travelplanner.test',
      picture: null,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(expires.getTime() / 1000),
      jti: crypto.randomUUID(),
    },
    secret: authSecret,
    salt: cookieName,
  });

  // ── 6. Write Playwright storage state ─────────────────────────────────────
  // NextAuth v5 on HTTP uses the `authjs.session-token` cookie name.
  const authState = {
    cookies: [
      {
        name: cookieName,
        value: jwt,
        domain: 'localhost',
        path: '/',
        expires: Math.floor(expires.getTime() / 1000),
        httpOnly: true,
        secure: false,
        sameSite: 'Lax' as const,
      },
    ],
    origins: [],
  };

  await writeFile(AUTH_STATE_FILE, JSON.stringify(authState, null, 2));
  console.log('[e2e] Auth storage state written.');

  // ── 7. Start Next.js production server (CI only) ──────────────────────────
  // In CI the app is pre-built via `pnpm build` and we manage the `next start`
  // process here — AFTER POSTGRES_URL is in process.env — so the server starts
  // with the real database URL.  Playwright's webServer plugin is intentionally
  // omitted from playwright.config.ts for CI because it spawns the command
  // *before* globalSetup runs, capturing an empty POSTGRES_URL.
  if (process.env.CI) {
    console.log('[e2e] Starting Next.js production server…');

    const serverLogFile = join(FIXTURES_DIR, 'next-server.log');

    // Open a log file and pass the raw FD to the child so output is captured
    // even after this process moves on.  Parent closes its copy immediately
    // after spawn; the child retains its own copy.
    const logFd = openSync(serverLogFile, 'w');
    const serverProcess = spawn('pnpm', ['start'], {
      env: { ...process.env }, // POSTGRES_URL is now set
      stdio: ['ignore', logFd, logFd],
      detached: true,
    });
    closeSync(logFd);

    if (!serverProcess.pid) {
      throw new Error('[e2e] Failed to obtain PID for Next.js server process');
    }

    // Detect an early crash so we can fail immediately rather than waiting
    // out the full poll timeout.
    let serverExitCode: number | null = null;
    serverProcess.on('exit', (code) => {
      serverExitCode = code ?? -1;
    });

    // Persist the process-group leader PID so globalTeardown can kill it.
    await writeFile(SERVER_PID_FILE, serverProcess.pid.toString());

    // Detach so globalSetup can return without keeping Node.js alive.
    serverProcess.unref();

    // Poll until the server accepts HTTP connections (or timeout).
    const serverUrl = 'http://localhost:3000';
    const timeoutMs = 60_000;
    const deadline = Date.now() + timeoutMs;

    let ready = false;
    while (Date.now() < deadline) {
      // Fail fast if the server process exited before becoming ready.
      if (serverExitCode !== null) {
        const log = await readFile(serverLogFile, 'utf-8').catch(() => '(no log)');
        throw new Error(
          `[e2e] Next.js server exited (code ${serverExitCode}) before becoming ready.\n` +
            `Server log:\n${log.slice(-3000)}`,
        );
      }

      try {
        const res = await fetch(serverUrl);
        if (res.status < 500) {
          ready = true;
          break;
        }
      } catch {
        // ECONNREFUSED — server not yet listening
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }

    if (!ready) {
      const log = await readFile(serverLogFile, 'utf-8').catch(() => '(no log)');
      throw new Error(
        `[e2e] Next.js server did not become ready within ${timeoutMs}ms.\n` +
          `Server log:\n${log.slice(-3000)}`,
      );
    }

    console.log('[e2e] Next.js production server ready.');
  }
}
