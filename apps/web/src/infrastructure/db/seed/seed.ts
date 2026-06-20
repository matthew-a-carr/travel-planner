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
import { ingestVisaData } from '../ingest-visa-rules';
import { countryReferenceData } from '../schema';
import { COUNTRY_LIST_SEED } from './country-list-seed';

async function seed() {
  const connectionString = process.env.POSTGRES_URL;
  if (!connectionString) {
    throw new Error('POSTGRES_URL environment variable is required');
  }

  const sql = postgres(connectionString, { max: 1 });
  const db = drizzle(sql);

  console.log(`Seeding ${COUNTRY_LIST_SEED.length} country reference records...`);

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

  const counts = await ingestVisaData(db);
  console.log(`Seeded ${counts.zones} visa zone(s) and ${counts.rules} visa rule(s).`);

  console.log('Seed complete.');
  await sql.end();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
