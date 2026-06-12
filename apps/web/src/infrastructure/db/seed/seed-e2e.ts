/**
 * E2E fixture seed entrypoint (SPEC-013).
 *
 * Run via: pnpm seed:e2e (or `pnpm --filter @travel-planner/web seed:e2e`)
 *
 * Seeds the deterministic e2e fixtures (user, org, Kyoto trip) on top of
 * an already-migrated database. Reference data is `pnpm db:seed`'s job —
 * run that first. Idempotent; safe to re-run.
 */
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { applyE2eFixtures } from './e2e-fixtures';

async function main() {
  const connectionString = process.env.POSTGRES_URL;
  if (!connectionString) {
    throw new Error('POSTGRES_URL environment variable is required');
  }

  const sql = postgres(connectionString, { max: 1 });
  try {
    console.log('Seeding e2e fixtures...');
    await applyE2eFixtures(drizzle(sql));
    console.log('E2E fixtures seeded.');
  } finally {
    await sql.end();
  }
}

main().catch((error) => {
  console.error('E2E fixture seed failed:', error);
  process.exit(1);
});
