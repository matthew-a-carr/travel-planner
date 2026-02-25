import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { DrizzleCountryReferenceRepository } from './drizzle-country-reference-repository';
import {
  type Db,
  type Sql,
  createTestDb,
  truncateAll,
} from '../../../infrastructure/testing/helpers';
import * as schema from '../schema';

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

async function seedCountryRef(
  db: Db,
  country: string,
  avgDailyCostPence: number,
): Promise<void> {
  await db.insert(schema.countryReferenceData).values({
    country,
    avgDailyCostPence,
    currency: 'GBP',
    source: 'manual',
    updatedAt: new Date(),
  });
}

describe('DrizzleCountryReferenceRepository', () => {
  describe('findAll', () => {
    it('returns an empty array when no reference data exists', async () => {
      const repo = new DrizzleCountryReferenceRepository(db);
      expect(await repo.findAll()).toEqual([]);
    });

    it('returns all seeded country references', async () => {
      await seedCountryRef(db, 'Japan', 8_000);
      await seedCountryRef(db, 'Thailand', 3_500);
      await seedCountryRef(db, 'Australia', 12_000);

      const repo = new DrizzleCountryReferenceRepository(db);
      const result = await repo.findAll();
      expect(result).toHaveLength(3);
    });

    it('returns rows ordered alphabetically by country', async () => {
      await seedCountryRef(db, 'Thailand', 3_500);
      await seedCountryRef(db, 'Japan', 8_000);

      const repo = new DrizzleCountryReferenceRepository(db);
      const result = await repo.findAll();
      expect(result.map((r) => r.country)).toEqual(['Japan', 'Thailand']);
    });

    it('maps avgDailyCostPence and currency correctly', async () => {
      await seedCountryRef(db, 'Japan', 8_000);

      const repo = new DrizzleCountryReferenceRepository(db);
      const result = await repo.findAll();
      expect(result[0]?.avgDailyCostPence).toBe(8_000);
      expect(result[0]?.currency).toBe('GBP');
    });
  });

  describe('findByCountry', () => {
    it('returns null when the country is not found', async () => {
      const repo = new DrizzleCountryReferenceRepository(db);
      expect(await repo.findByCountry('Narnia')).toBeNull();
    });

    it('returns the reference for an exact country name match', async () => {
      await seedCountryRef(db, 'Japan', 8_000);

      const repo = new DrizzleCountryReferenceRepository(db);
      const result = await repo.findByCountry('Japan');
      expect(result?.country).toBe('Japan');
      expect(result?.avgDailyCostPence).toBe(8_000);
    });

    it('returns null for a case-variant match (DB lookup is exact)', async () => {
      await seedCountryRef(db, 'Japan', 8_000);

      const repo = new DrizzleCountryReferenceRepository(db);
      // The DB lookup is exact. Case-insensitive matching is a domain-layer concern
      // handled by findReference() in country-reference.ts.
      expect(await repo.findByCountry('japan')).toBeNull();
    });
  });
});
