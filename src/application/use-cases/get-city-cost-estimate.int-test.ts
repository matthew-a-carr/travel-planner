import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { DrizzleCityReferenceRepository } from '@/infrastructure/db/repositories/drizzle-city-reference-repository';
import { DrizzleCountryReferenceRepository } from '@/infrastructure/db/repositories/drizzle-country-reference-repository';
import {
  createTestDb,
  type Db,
  type Sql,
  seedCityReference,
  seedCountryReference,
  truncateAll,
} from '@/infrastructure/testing/helpers';
import { getCityCostEstimate } from './get-city-cost-estimate';

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

function repos(db: Db) {
  return {
    countryRefRepo: new DrizzleCountryReferenceRepository(db),
    cityRefRepo: new DrizzleCityReferenceRepository(db),
  };
}

describe('getCityCostEstimate', () => {
  it('returns city-level estimate with high confidence for manual data', async () => {
    const { countryRefRepo, cityRefRepo } = repos(db);
    await seedCountryReference(db, {
      country: 'Japan',
      avgDailyCostPence: 8_000,
    });
    await seedCityReference(db, {
      city: 'Tokyo',
      country: 'Japan',
      costMultiplier: 1.5,
      source: 'manual',
    });

    const result = await getCityCostEstimate(countryRefRepo, cityRefRepo, {
      country: 'Japan',
      city: 'Tokyo',
      days: 10,
      comfortLevel: 'mid',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.dailyCostPence).toBe(12_000); // 8000 × 1.5
    expect(result.value.totalPence).toBe(120_000);
    expect(result.value.confidence).toBe('high');
    expect(result.value.cityName).toBe('Tokyo');
  });

  it('falls back to country level with low confidence when no city data', async () => {
    const { countryRefRepo, cityRefRepo } = repos(db);
    await seedCountryReference(db, {
      country: 'Japan',
      avgDailyCostPence: 8_000,
    });

    const result = await getCityCostEstimate(countryRefRepo, cityRefRepo, {
      country: 'Japan',
      city: 'Unknown City',
      days: 10,
      comfortLevel: 'mid',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.dailyCostPence).toBe(8_000); // country baseline, no multiplier
    expect(result.value.totalPence).toBe(80_000);
    expect(result.value.confidence).toBe('low');
    expect(result.value.cityName).toBeNull();
  });

  it('returns medium confidence for estimated city data', async () => {
    const { countryRefRepo, cityRefRepo } = repos(db);
    await seedCountryReference(db, {
      country: 'Japan',
      avgDailyCostPence: 8_000,
    });
    await seedCityReference(db, {
      city: 'Osaka',
      country: 'Japan',
      costMultiplier: 1.1,
      source: 'estimated',
    });

    const result = await getCityCostEstimate(countryRefRepo, cityRefRepo, {
      country: 'Japan',
      city: 'Osaka',
      days: 5,
      comfortLevel: 'mid',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.confidence).toBe('medium');
  });

  it('applies comfort level multiplier with city multiplier', async () => {
    const { countryRefRepo, cityRefRepo } = repos(db);
    await seedCountryReference(db, {
      country: 'Japan',
      avgDailyCostPence: 8_000,
    });
    await seedCityReference(db, {
      city: 'Tokyo',
      country: 'Japan',
      costMultiplier: 1.5,
    });

    const result = await getCityCostEstimate(countryRefRepo, cityRefRepo, {
      country: 'Japan',
      city: 'Tokyo',
      days: 10,
      comfortLevel: 'budget',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // 8000 × 1.5 × 0.65 = 7800
    expect(result.value.dailyCostPence).toBe(7_800);
  });

  it('returns err when country is not found', async () => {
    const { countryRefRepo, cityRefRepo } = repos(db);

    const result = await getCityCostEstimate(countryRefRepo, cityRefRepo, {
      country: 'Narnia',
      city: null,
      days: 10,
      comfortLevel: 'mid',
    });

    expect(result.ok).toBe(false);
  });

  it('works with null city (country-level estimate)', async () => {
    const { countryRefRepo, cityRefRepo } = repos(db);
    await seedCountryReference(db, {
      country: 'Japan',
      avgDailyCostPence: 8_000,
    });

    const result = await getCityCostEstimate(countryRefRepo, cityRefRepo, {
      country: 'Japan',
      city: null,
      days: 7,
      comfortLevel: 'luxury',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // 8000 × 1.0 × 1.8 = 14400/day × 7 = 100800
    expect(result.value.dailyCostPence).toBe(14_400);
    expect(result.value.totalPence).toBe(100_800);
    expect(result.value.confidence).toBe('low');
  });
});
