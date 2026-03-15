import { describe, expect, it } from 'vitest';
import {
  COMFORT_MULTIPLIERS,
  DEFAULT_BREAKDOWN,
  determineConfidence,
  estimateCityBudget,
  findReference,
  suggestBudget,
} from './country-reference';
import type { CityReference, CountryReference } from './types';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const japanRef: CountryReference = {
  country: 'Japan',
  alpha2: 'JP',
  alpha3: 'JPN',
  region: 'Asia',
  subregion: 'Eastern Asia',
  avgDailyCostPence: 8_000, // £80/day mid-range
  currency: 'GBP',
  source: 'manual',
};

const thaiRef: CountryReference = {
  country: 'Thailand',
  alpha2: 'TH',
  alpha3: 'THA',
  region: 'Asia',
  subregion: 'South-Eastern Asia',
  avgDailyCostPence: 3_500, // £35/day mid-range
  currency: 'GBP',
  source: 'manual',
};

const references: CountryReference[] = [japanRef, thaiRef];

// ─── COMFORT_MULTIPLIERS ──────────────────────────────────────────────────────

describe('COMFORT_MULTIPLIERS', () => {
  it('should have mid multiplier of 1.0', () => {
    expect(COMFORT_MULTIPLIERS.mid).toBe(1.0);
  });

  it('should have budget multiplier below 1.0', () => {
    expect(COMFORT_MULTIPLIERS.budget).toBeLessThan(1.0);
    expect(COMFORT_MULTIPLIERS.budget).toBeGreaterThan(0);
  });

  it('should have luxury multiplier above 1.0', () => {
    expect(COMFORT_MULTIPLIERS.luxury).toBeGreaterThan(1.0);
  });
});

// ─── findReference ────────────────────────────────────────────────────────────

describe('findReference', () => {
  it('should find a reference by exact country name', () => {
    const result = findReference('Japan', references);
    expect(result).toBe(japanRef);
  });

  it('should match case-insensitively', () => {
    expect(findReference('japan', references)).toBe(japanRef);
    expect(findReference('THAILAND', references)).toBe(thaiRef);
    expect(findReference('tHaIlAnD', references)).toBe(thaiRef);
  });

  it('should trim whitespace before matching', () => {
    expect(findReference('  Japan  ', references)).toBe(japanRef);
  });

  it('should return null when country is not found', () => {
    expect(findReference('Narnia', references)).toBeNull();
  });

  it('should return null for an empty references array', () => {
    expect(findReference('Japan', [])).toBeNull();
  });
});

// ─── suggestBudget ────────────────────────────────────────────────────────────

describe('suggestBudget', () => {
  it('should return mid-range cost for exactly the number of days', () => {
    // 30 days × £80/day × 1.0 = £2,400 = 240,000p
    const result = suggestBudget(30, japanRef, 'mid');
    expect(result.amountPence).toBe(240_000);
    expect(result.currency).toBe('GBP');
  });

  it('should apply budget multiplier', () => {
    // 10 days × £80/day × 0.65 = £52 = 52,000p
    const result = suggestBudget(10, japanRef, 'budget');
    expect(result.amountPence).toBe(Math.round(10 * 8_000 * COMFORT_MULTIPLIERS.budget));
  });

  it('should apply luxury multiplier', () => {
    // 10 days × £80/day × 1.8 = £144 = 144,000p
    const result = suggestBudget(10, japanRef, 'luxury');
    expect(result.amountPence).toBe(Math.round(10 * 8_000 * COMFORT_MULTIPLIERS.luxury));
  });

  it('should round to the nearest penny (no fractional pence)', () => {
    // 7 days × £35/day × 0.65 = £159.25 = 15,925p (exact)
    const result = suggestBudget(7, thaiRef, 'budget');
    expect(Number.isInteger(result.amountPence)).toBe(true);
  });

  it('should return 0 for 0 days', () => {
    const result = suggestBudget(0, japanRef, 'mid');
    expect(result.amountPence).toBe(0);
  });

  it('should inherit currency from the reference', () => {
    const result = suggestBudget(1, japanRef, 'mid');
    expect(result.currency).toBe(japanRef.currency);
  });
});

// ─── determineConfidence ─────────────────────────────────────────────────────

describe('determineConfidence', () => {
  it('should return "low" when no city reference exists', () => {
    expect(determineConfidence(null)).toBe('low');
  });

  it('should return "high" for manual city data', () => {
    const cityRef: CityReference = {
      city: 'Tokyo',
      country: 'Japan',
      costMultiplier: 1.5,
      source: 'manual',
    };
    expect(determineConfidence(cityRef)).toBe('high');
  });

  it('should return "medium" for estimated city data', () => {
    const cityRef: CityReference = {
      city: 'Osaka',
      country: 'Japan',
      costMultiplier: 1.1,
      source: 'estimated',
    };
    expect(determineConfidence(cityRef)).toBe('medium');
  });
});

// ─── estimateCityBudget ──────────────────────────────────────────────────────

describe('estimateCityBudget', () => {
  const tokyoRef: CityReference = {
    city: 'Tokyo',
    country: 'Japan',
    costMultiplier: 1.5,
    source: 'manual',
  };

  it('should apply city multiplier on top of country baseline', () => {
    // 10 days × (£80/day × 1.5 city × 1.0 mid) = £1,200 = 120,000p
    const result = estimateCityBudget(10, japanRef, 'mid', tokyoRef);
    expect(result.dailyCostPence).toBe(12_000); // 8000 × 1.5
    expect(result.totalPence).toBe(120_000);
    expect(result.currency).toBe('GBP');
    expect(result.confidence).toBe('high');
    expect(result.cityName).toBe('Tokyo');
  });

  it('should compose city and comfort multipliers', () => {
    // 10 days × (£80/day × 1.5 city × 0.65 budget)
    const result = estimateCityBudget(10, japanRef, 'budget', tokyoRef);
    const expected = Math.round(8_000 * 1.5 * 0.65);
    expect(result.dailyCostPence).toBe(expected);
    expect(result.totalPence).toBe(Math.round(10 * expected));
  });

  it('should fall back to country level when no city ref', () => {
    const result = estimateCityBudget(10, japanRef, 'mid', null);
    expect(result.dailyCostPence).toBe(8_000); // no city multiplier
    expect(result.totalPence).toBe(80_000);
    expect(result.confidence).toBe('low');
    expect(result.cityName).toBeNull();
  });

  it('should include default category breakdown', () => {
    const result = estimateCityBudget(1, japanRef, 'mid', tokyoRef);
    expect(result.breakdown).toEqual(DEFAULT_BREAKDOWN);
    expect(
      result.breakdown.accommodation +
        result.breakdown.food +
        result.breakdown.transport +
        result.breakdown.activities,
    ).toBe(100);
  });
});
