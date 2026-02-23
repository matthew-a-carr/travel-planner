/**
 * Database seed script.
 *
 * Run via: pnpm db:seed
 *
 * Safe to run multiple times — uses upsert (INSERT ... ON CONFLICT DO UPDATE).
 * Existing rows are updated; new rows are inserted.
 */
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { countryReferenceData } from '../schema';
import { COUNTRY_REFERENCE_SEED } from './country-reference-seed';

async function seed() {
  const connectionString = process.env.POSTGRES_URL;
  if (!connectionString) {
    throw new Error('POSTGRES_URL environment variable is required');
  }

  const sql = postgres(connectionString, { max: 1 });
  const db = drizzle(sql);

  console.log(`Seeding ${COUNTRY_REFERENCE_SEED.length} country reference records...`);

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

  console.log('Seed complete.');
  await sql.end();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
