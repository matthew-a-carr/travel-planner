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

import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { countryReferenceData, sessions, users } from '../../../src/infrastructure/db/schema';
import { COUNTRY_REFERENCE_SEED } from '../../../src/infrastructure/db/seed/country-reference-seed';

const FIXTURES_DIR = join(process.cwd(), 'tests/e2e/fixtures');
const CONTAINER_ID_FILE = join(FIXTURES_DIR, '.container-id');
const AUTH_STATE_FILE = join(FIXTURES_DIR, 'auth-state.json');

export default async function globalSetup(): Promise<void> {
  await mkdir(FIXTURES_DIR, { recursive: true });

  // ── 1. Start PostgreSQL container ─────────────────────────────────────────
  console.log('[e2e] Starting PostgreSQL container…');
  const container = await new PostgreSqlContainer('postgres:16-alpine')
    .withDatabase('travel_planner_test')
    .withUsername('testuser')
    .withPassword('testpass')
    .start();

  const connectionUri = container.getConnectionUri();

  // Make the URL available to the Next.js web server that Playwright
  // will spawn after globalSetup completes.
  process.env.POSTGRES_URL = connectionUri;

  // Persist the container ID for globalTeardown.
  await writeFile(CONTAINER_ID_FILE, container.getId());
  console.log(`[e2e] PostgreSQL ready at ${connectionUri}`);

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

  // ── 5. Create test session ──────────────────────────────────────────────────
  const sessionToken = crypto.randomUUID();
  const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
  await db.insert(sessions).values({ sessionToken, userId, expires });

  await sql.end();

  // ── 6. Write Playwright storage state ─────────────────────────────────────
  // NextAuth v5 on HTTP uses the `authjs.session-token` cookie name.
  const authState = {
    cookies: [
      {
        name: 'authjs.session-token',
        value: sessionToken,
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
}
