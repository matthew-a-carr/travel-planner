import { describe, expect, it } from 'vitest';
import { COMFORT_MULTIPLIERS, findReference, suggestBudget } from './country-reference';
import type { CountryReference } from './types';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const japanRef: CountryReference = {
  country: 'Japan',
  avgDailyCostPence: 8_000, // £80/day mid-range
  currency: 'GBP',
  source: 'manual',
};

const thaiRef: CountryReference = {
  country: 'Thailand',
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
