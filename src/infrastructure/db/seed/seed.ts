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
import { cityReferenceData, countryReferenceData } from '../schema';
import { CITY_LIST_SEED } from './city-list-seed';
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

  console.log(`Seeding ${CITY_LIST_SEED.length} city reference records...`);

  for (const row of CITY_LIST_SEED) {
    await db
      .insert(cityReferenceData)
      .values({
        city: row.city,
        country: row.country,
        costMultiplier: row.costMultiplier,
        source: row.source,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [cityReferenceData.city, cityReferenceData.country],
        set: {
          costMultiplier: row.costMultiplier,
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
