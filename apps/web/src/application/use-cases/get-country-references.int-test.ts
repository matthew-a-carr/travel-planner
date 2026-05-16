import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { DrizzleCountryReferenceRepository } from '@/infrastructure/db/repositories/drizzle-country-reference-repository';
import {
  createTestDb,
  type Db,
  type Sql,
  seedCountryReference,
  truncateAll,
} from '@/infrastructure/testing/helpers';
import { getCountryReferences } from './get-country-references';

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

describe('getCountryReferences', () => {
  it('returns an empty array when there are no country records', async () => {
    const repo = new DrizzleCountryReferenceRepository(db);
    const results = await getCountryReferences(repo);
    expect(results).toEqual([]);
  });

  it('returns seeded country references', async () => {
    await seedCountryReference(db, { country: 'Japan', avgDailyCostPence: 7_500 });
    const repo = new DrizzleCountryReferenceRepository(db);

    const results = await getCountryReferences(repo);

    expect(results).toHaveLength(1);
    expect(results[0]?.country).toBe('Japan');
    expect(results[0]?.avgDailyCostPence).toBe(7_500);
  });

  it('returns multiple countries ordered alphabetically', async () => {
    await seedCountryReference(db, {
      country: 'Thailand',
      alpha2: 'TH',
      alpha3: 'THA',
      avgDailyCostPence: 4_000,
    });
    await seedCountryReference(db, {
      country: 'Australia',
      alpha2: 'AU',
      alpha3: 'AUS',
      region: 'Oceania',
      subregion: 'Australia and New Zealand',
      avgDailyCostPence: 10_000,
    });
    await seedCountryReference(db, { country: 'Japan', avgDailyCostPence: 7_500 });

    const repo = new DrizzleCountryReferenceRepository(db);
    const results = await getCountryReferences(repo);

    expect(results).toHaveLength(3);
    expect(results.map((r) => r.country)).toEqual(['Australia', 'Japan', 'Thailand']);
  });
});
