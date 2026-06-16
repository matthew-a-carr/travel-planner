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
import { countryReferenceData, visaRules, visaZoneMembership, visaZones } from '../schema';
import { COUNTRY_LIST_SEED } from './country-list-seed';
import { AI_VISA_RULES_SEED } from './visa-rule-ai-seed';
import { VISA_RULES_SEED, VISA_ZONE_MEMBERSHIP_SEED, VISA_ZONES_SEED } from './visa-rule-seed';

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

  console.log(`Seeding ${VISA_ZONES_SEED.length} visa zone(s)...`);
  for (const zone of VISA_ZONES_SEED) {
    await db
      .insert(visaZones)
      .values({ ...zone, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: visaZones.code,
        set: {
          name: zone.name,
          rollingAllowanceDays: zone.rollingAllowanceDays,
          rollingWindowDays: zone.rollingWindowDays,
          notes: zone.notes,
          updatedAt: new Date(),
        },
      });
  }

  console.log(`Seeding ${VISA_ZONE_MEMBERSHIP_SEED.length} visa zone membership(s)...`);
  for (const member of VISA_ZONE_MEMBERSHIP_SEED) {
    await db.insert(visaZoneMembership).values(member).onConflictDoNothing();
  }

  const allVisaRules = [...VISA_RULES_SEED, ...AI_VISA_RULES_SEED];
  console.log(
    `Seeding ${allVisaRules.length} visa rule(s) (${VISA_RULES_SEED.length} manual, ${AI_VISA_RULES_SEED.length} ai-extracted)...`,
  );
  for (const rule of allVisaRules) {
    await db
      .insert(visaRules)
      .values({ ...rule, otherRequirements: rule.otherRequirements, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: [
          visaRules.nationality,
          visaRules.destination,
          visaRules.purpose,
          visaRules.validFrom,
        ],
        set: {
          zoneCode: rule.zoneCode,
          workRights: rule.workRights,
          minAgeYears: rule.minAgeYears,
          maxAgeYears: rule.maxAgeYears,
          eligibilityNotes: rule.eligibilityNotes,
          category: rule.category,
          maxStayDays: rule.maxStayDays,
          visaValidityDays: rule.visaValidityDays,
          entryType: rule.entryType,
          minDaysOutBeforeReturn: rule.minDaysOutBeforeReturn,
          rollingAllowanceDays: rule.rollingAllowanceDays,
          rollingWindowDays: rule.rollingWindowDays,
          otherRequirements: rule.otherRequirements,
          validTo: rule.validTo,
          source: rule.source,
          sourceNote: rule.sourceNote,
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
