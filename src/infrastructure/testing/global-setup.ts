/**
 * Vitest globalSetup for the integration test project.
 *
 * Responsibilities:
 *  1. Start a throwaway PostgreSQL 16 container via Testcontainers.
 *  2. Expose the connection string via POSTGRES_URL so every test file
 *     can call createTestDb() from helpers.ts to get a scoped connection.
 *  3. Run Drizzle migrations against the fresh database.
 *  4. Return a teardown function that stops the container when the suite ends.
 *
 * The container is shared across all integration test files for the entire
 * run — it is NOT restarted between test files. Test isolation is achieved
 * by calling truncateAll(db) in beforeEach within each test file.
 *
 * Testcontainers' Ryuk side-car automatically reaps the container on
 * process exit, even if teardown is not called (e.g. SIGKILL).
 */

import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

let containerStop: (() => Promise<void>) | null = null;

export async function setup(): Promise<void> {
  console.log('[integration] Starting PostgreSQL container…');
  const container = await new PostgreSqlContainer('postgres:16-alpine')
    .withDatabase('travel_planner_integration')
    .withUsername('testuser')
    .withPassword('testpass')
    .start();

  const connectionUri = container.getConnectionUri();
  process.env.POSTGRES_URL = connectionUri;

  containerStop = () => container.stop();
  console.log(`[integration] PostgreSQL ready at ${connectionUri}`);

  const sql = postgres(connectionUri, { max: 1 });
  try {
    console.log('[integration] Running migrations…');
    await migrate(drizzle(sql), { migrationsFolder: './drizzle' });
    console.log('[integration] Migrations complete.');
  } finally {
    await sql.end();
  }
}

export async function teardown(): Promise<void> {
  await containerStop?.();
  console.log('[integration] PostgreSQL container stopped.');
}
