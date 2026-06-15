import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { TravellerProfile } from '@/domain/visa/types';
import { DrizzleCountryReferenceRepository } from '../../infrastructure/db/repositories/drizzle-country-reference-repository';
import { DrizzleDestinationRepository } from '../../infrastructure/db/repositories/drizzle-destination-repository';
import { DrizzleVisaRuleRepository } from '../../infrastructure/db/repositories/drizzle-visa-rule-repository';
import { visaRules, visaZoneMembership, visaZones } from '../../infrastructure/db/schema';
import {
  createTestDb,
  type Db,
  type Sql,
  seedCountryReference,
  seedDestination,
  seedTrip,
  seedUser,
  truncateAll,
} from '../../infrastructure/testing/helpers';
import { assessTripVisas } from './assess-trip-visas';

let db: Db;
let sql: Sql;

beforeAll(() => {
  ({ db, sql } = createTestDb());
});

afterAll(async () => {
  await sql.end();
});

beforeEach(async () => {
  await truncateAll(db);
});

const gbr: TravellerProfile = {
  passports: [{ nationality: 'GBR', label: 'UK passport' }],
  dateOfBirth: '1991-06-15',
};

function repos() {
  return {
    dest: new DrizzleDestinationRepository(db),
    ref: new DrizzleCountryReferenceRepository(db),
    visa: new DrizzleVisaRuleRepository(db),
  };
}

async function seedSchengen() {
  await db.insert(visaZones).values({
    code: 'SCHENGEN',
    name: 'Schengen Area',
    rollingAllowanceDays: 90,
    rollingWindowDays: 180,
  });
  await db.insert(visaZoneMembership).values([
    { zoneCode: 'SCHENGEN', alpha3: 'FRA' },
    { zoneCode: 'SCHENGEN', alpha3: 'ITA' },
    { zoneCode: 'SCHENGEN', alpha3: 'ESP' },
  ]);
  for (const dest of ['FRA', 'ITA', 'ESP']) {
    await db.insert(visaRules).values({
      nationality: 'GBR',
      destination: dest,
      zoneCode: 'SCHENGEN',
      purpose: 'tourism',
      category: 'visa-free',
      maxStayDays: null,
      entryType: 'multiple',
      rollingAllowanceDays: 90,
      rollingWindowDays: 180,
      validFrom: '2021-01-01',
      source: 'manual',
    });
  }
}

describe('assessTripVisas', () => {
  it('raises one Schengen zone-level rolling-window violation across three countries', async () => {
    const { id: ownerId } = await seedUser(db);
    const trip = await seedTrip(db, ownerId);
    await seedCountryReference(db, { country: 'France', alpha2: 'FR', alpha3: 'FRA' });
    await seedCountryReference(db, { country: 'Italy', alpha2: 'IT', alpha3: 'ITA' });
    await seedCountryReference(db, { country: 'Spain', alpha2: 'ES', alpha3: 'ESP' });
    await seedDestination(db, trip.id, {
      country: 'France',
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-02-10'),
    });
    await seedDestination(db, trip.id, {
      country: 'Italy',
      startDate: new Date('2026-02-10'),
      endDate: new Date('2026-03-12'),
    });
    await seedDestination(db, trip.id, {
      country: 'Spain',
      startDate: new Date('2026-03-12'),
      endDate: new Date('2026-04-06'),
    });
    await seedSchengen();

    const { dest, ref, visa } = repos();
    const result = await assessTripVisas(dest, ref, visa, { tripId: trip.id, profile: gbr });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.coverages).toHaveLength(1);
    const cov = result.value.coverages[0];
    expect(cov.destination).toBe('SCHENGEN');
    expect(cov.stay.totalDays).toBe(95);
    expect(cov.violations.filter((v) => v.kind === 'rolling-window-exceeded')).toHaveLength(1);
  });

  it('reports a within-limit Japan stay as ok', async () => {
    const { id: ownerId } = await seedUser(db);
    const trip = await seedTrip(db, ownerId);
    await seedCountryReference(db, { country: 'Japan', alpha2: 'JP', alpha3: 'JPN' });
    await seedDestination(db, trip.id, {
      country: 'Japan',
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-02-01'),
    });
    await db.insert(visaRules).values({
      nationality: 'GBR',
      destination: 'JPN',
      category: 'visa-free',
      maxStayDays: 90,
      entryType: 'multiple',
      validFrom: '2020-01-01',
      source: 'manual',
    });

    const { dest, ref, visa } = repos();
    const result = await assessTripVisas(dest, ref, visa, { tripId: trip.id, profile: gbr });
    if (!result.ok) throw new Error('expected ok');
    expect(result.value.coverages[0].status).toBe('ok');
  });

  it('auto-selects the tourist rule and offers working-holiday as an alternative for an eligible traveller', async () => {
    const { id: ownerId } = await seedUser(db);
    const trip = await seedTrip(db, ownerId);
    await seedCountryReference(db, { country: 'Australia', alpha2: 'AU', alpha3: 'AUS' });
    await seedDestination(db, trip.id, {
      country: 'Australia',
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-01-31'),
    });
    await db.insert(visaRules).values([
      {
        nationality: 'GBR',
        destination: 'AUS',
        purpose: 'tourism',
        category: 'eta',
        maxStayDays: 90,
        entryType: 'multiple',
        validFrom: '2020-01-01',
        source: 'manual',
      },
      {
        nationality: 'GBR',
        destination: 'AUS',
        purpose: 'working-holiday',
        workRights: true,
        minAgeYears: 18,
        maxAgeYears: 35,
        category: 'visa-required',
        maxStayDays: 365,
        entryType: 'multiple',
        validFrom: '2020-01-01',
        source: 'manual',
      },
    ]);

    const { dest, ref, visa } = repos();
    const result = await assessTripVisas(dest, ref, visa, { tripId: trip.id, profile: gbr });
    if (!result.ok) throw new Error('expected ok');
    const cov = result.value.coverages[0];
    expect(cov.purpose).toBe('tourism');
    expect(cov.alternativeRuleIds).toHaveLength(1);
  });
});
