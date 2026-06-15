import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  createTestDb,
  type Db,
  type Sql,
  truncateAll,
} from '../../../infrastructure/testing/helpers';
import { visaRules, visaZoneMembership, visaZones } from '../schema';
import { DrizzleVisaRuleRepository } from './drizzle-visa-rule-repository';

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

async function insertRule(overrides: Partial<typeof visaRules.$inferInsert> = {}) {
  await db.insert(visaRules).values({
    nationality: 'GBR',
    destination: 'JPN',
    category: 'visa-free',
    maxStayDays: 90,
    entryType: 'multiple',
    validFrom: '2020-01-01',
    ...overrides,
  });
}

describe('DrizzleVisaRuleRepository', () => {
  it('maps a stored rule back into the domain shape including rolling window', async () => {
    await insertRule({
      destination: 'FRA',
      zoneCode: 'SCHENGEN',
      maxStayDays: null,
      rollingAllowanceDays: 90,
      rollingWindowDays: 180,
      otherRequirements: ['Passport valid 3 months'],
      sourceNote: 'gov.uk',
    });

    const repo = new DrizzleVisaRuleRepository(db);
    const rules = await repo.findByNationality('GBR');
    expect(rules).toHaveLength(1);
    expect(rules[0].destination).toBe('FRA');
    expect(rules[0].zoneCode).toBe('SCHENGEN');
    expect(rules[0].rollingWindow).toEqual({ allowanceDays: 90, windowDays: 180 });
    expect(rules[0].otherRequirements).toEqual(['Passport valid 3 months']);
  });

  it('returns null rolling window when the columns are unset', async () => {
    await insertRule();
    const repo = new DrizzleVisaRuleRepository(db);
    const rules = await repo.findByNationality('GBR');
    expect(rules[0].rollingWindow).toBeNull();
  });

  it('filters by nationalities and destinations', async () => {
    await insertRule({ destination: 'JPN' });
    await insertRule({ destination: 'AUS' });
    await insertRule({ nationality: 'IRL', destination: 'JPN' });

    const repo = new DrizzleVisaRuleRepository(db);
    const rules = await repo.findByNationalitiesAndDestinations(['GBR'], ['JPN']);
    expect(rules).toHaveLength(1);
    expect(rules[0].nationality).toBe('GBR');
    expect(rules[0].destination).toBe('JPN');
  });

  it('returns nothing for empty inputs', async () => {
    await insertRule();
    const repo = new DrizzleVisaRuleRepository(db);
    expect(await repo.findByNationalitiesAndDestinations([], ['JPN'])).toHaveLength(0);
    expect(await repo.findByNationalitiesAndDestinations(['GBR'], [])).toHaveLength(0);
  });

  it('reads zone memberships', async () => {
    await db.insert(visaZones).values({ code: 'SCHENGEN', name: 'Schengen Area' });
    await db.insert(visaZoneMembership).values([
      { zoneCode: 'SCHENGEN', alpha3: 'FRA' },
      { zoneCode: 'SCHENGEN', alpha3: 'ITA' },
    ]);

    const repo = new DrizzleVisaRuleRepository(db);
    const memberships = await repo.findZoneMemberships();
    expect(memberships.map((m) => m.alpha3).sort()).toEqual(['FRA', 'ITA']);
  });
});
