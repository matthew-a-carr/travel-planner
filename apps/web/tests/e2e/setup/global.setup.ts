/**
 * Playwright global setup — Testcontainers-backed PostgreSQL.
 *
 * Responsibilities:
 *  1. Wait for the web-server bootstrap to provision PostgreSQL and persist
 *     its connection URL.
 *  2. Run Drizzle migrations against the fresh database.
 *  3. Seed country reference data.
 *  4. Create a test user and write a JWT-backed Playwright
 *     storage-state file (auth-state.json) so authenticated
 *     tests start with a valid auth cookie.
 *  5. Persist the container ID to fixtures/.container-id so
 *     global.teardown.ts can stop it cleanly.
 *
 * The container is automatically reaped by Testcontainers' Ryuk
 * side-car even if teardown never runs (e.g. on a SIGKILL).
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { encode } from 'next-auth/jwt';
import postgres from 'postgres';
import {
  countryReferenceData,
  organizationMemberships,
  organizations,
  users,
  visaRules,
  visaZoneMembership,
  visaZones,
} from '../../../src/infrastructure/db/schema';
import { COUNTRY_LIST_SEED } from '../../../src/infrastructure/db/seed/country-list-seed';
import {
  VISA_RULES_SEED,
  VISA_ZONE_MEMBERSHIP_SEED,
  VISA_ZONES_SEED,
} from '../../../src/infrastructure/db/seed/visa-rule-seed';
import {
  E2E_AUTH_STATE_FILE,
  E2E_FIXTURES_DIR,
  E2E_POSTGRES_URL_FILE,
} from './e2e-env';
const SESSION_COOKIE_NAME = 'authjs.session-token';
const E2E_DEFAULT_AUTH_SECRET = 'dev-only-not-a-real-secret';
const STARTUP_TIMEOUT_MS = 120_000;
const POLL_INTERVAL_MS = 250;

async function waitForPostgresUrlFile(): Promise<string> {
  const deadline = Date.now() + STARTUP_TIMEOUT_MS;

  while (Date.now() < deadline) {
    try {
      const connectionUri = (await readFile(E2E_POSTGRES_URL_FILE, 'utf8')).trim();
      if (connectionUri) return connectionUri;
    } catch {
      // File is not ready yet; continue polling.
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  throw new Error(`Timed out waiting for ${E2E_POSTGRES_URL_FILE}`);
}

export default async function globalSetup(): Promise<void> {
  await mkdir(E2E_FIXTURES_DIR, { recursive: true });

  // ── 1. Read PostgreSQL URL from web-server bootstrap ──────────────────────
  console.log('[e2e] Waiting for PostgreSQL container bootstrap…');
  const connectionUri = await waitForPostgresUrlFile();
  process.env.POSTGRES_URL = connectionUri;
  await writeFile(E2E_POSTGRES_URL_FILE, connectionUri);
  console.log(`[e2e] PostgreSQL ready at ${connectionUri}`);

  // ── 2. Run migrations ──────────────────────────────────────────────────────
  const sql = postgres(connectionUri, { max: 1 });
  const db = drizzle(sql);

  console.log('[e2e] Running database migrations…');
  await migrate(db, { migrationsFolder: './drizzle' });
  console.log('[e2e] Migrations complete.');

  // ── 3. Seed country reference data ─────────────────────────────────────────
  console.log('[e2e] Seeding country reference data…');
  for (const row of COUNTRY_LIST_SEED) {
    await db
      .insert(countryReferenceData)
      .values({
        country: row.country,
        alpha2: row.alpha2,
        alpha3: row.alpha3,
        region: row.region,
        subregion: row.subregion,
        avgDailyCostPence: row.avgDailyCostPence,
        currency: row.currency,
        source: row.source,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: countryReferenceData.country,
        set: {
          alpha2: row.alpha2,
          alpha3: row.alpha3,
          region: row.region,
          subregion: row.subregion,
          avgDailyCostPence: row.avgDailyCostPence,
          currency: row.currency,
          source: row.source,
          updatedAt: new Date(),
        },
      });
  }
  console.log('[e2e] Country reference data seeded.');

  // ── 3b. Seed visa reference data (zones, memberships, rules) ────────────────
  console.log('[e2e] Seeding visa reference data…');
  for (const zone of VISA_ZONES_SEED) {
    await db
      .insert(visaZones)
      .values({ ...zone, updatedAt: new Date() })
      .onConflictDoNothing();
  }
  for (const member of VISA_ZONE_MEMBERSHIP_SEED) {
    await db.insert(visaZoneMembership).values(member).onConflictDoNothing();
  }
  for (const rule of VISA_RULES_SEED) {
    await db
      .insert(visaRules)
      .values({ ...rule, otherRequirements: rule.otherRequirements, updatedAt: new Date() })
      .onConflictDoNothing();
  }
  console.log('[e2e] Visa reference data seeded.');

  // ── 4. Create test user ─────────────────────────────────────────────────────
  const userId = crypto.randomUUID();
  await db.insert(users).values({
    id: userId,
    name: 'E2E Test User',
    firstName: 'E2E',
    lastName: 'Test User',
    email: 'e2e@travelplanner.test',
    isApproved: true,
    isAdmin: true,
    emailVerified: null,
    image: null,
  });
  const organizationId = crypto.randomUUID();
  const now = new Date();
  await db.insert(organizations).values({
    id: organizationId,
    name: 'E2E Test User Org',
    createdByUserId: userId,
    createdAt: now,
    updatedAt: now,
  });
  await db.insert(organizationMemberships).values({
    organizationId,
    userId,
    role: 'owner',
    createdAt: now,
  });

  await sql.end();

  // ── 6. Write Playwright storage state ─────────────────────────────────────
  const maxAgeSeconds = 30 * 24 * 60 * 60;
  const expires = new Date(Date.now() + maxAgeSeconds * 1000);
  const secret = process.env.AUTH_SECRET ?? E2E_DEFAULT_AUTH_SECRET;
  const sessionToken = await encode({
    token: {
      sub: userId,
      name: 'E2E Test User',
      email: 'e2e@travelplanner.test',
      picture: null,
      isApproved: true,
    },
    secret,
    salt: SESSION_COOKIE_NAME,
    maxAge: maxAgeSeconds,
  });

  const authState = {
    cookies: [
      {
        name: SESSION_COOKIE_NAME,
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

  await writeFile(E2E_AUTH_STATE_FILE, JSON.stringify(authState, null, 2));
  console.log('[e2e] Auth storage state written.');
}
