import { describe, expect, it } from 'vitest';
import type { ParsedItineraryRow } from '@/domain/timeline/types';
import { suggestTripBudgetPence, suggestTripName } from './trip-suggestion';

function row(overrides: Partial<ParsedItineraryRow> = {}): ParsedItineraryRow {
  return {
    country: 'Vietnam',
    city: null,
    startDate: null,
    endDate: null,
    comfortLevel: null,
    suggestedBudgetPence: null,
    confidence: 'medium',
    notes: null,
    ...overrides,
  };
}

describe('suggestTripName', () => {
  it('returns the fallback when no rows are provided', () => {
    expect(suggestTripName([])).toBe('New trip');
  });

  it('returns the fallback when rows have empty country names', () => {
    expect(suggestTripName([row({ country: '   ' })])).toBe('New trip');
  });

  it('formats a single country with a single month', () => {
    expect(
      suggestTripName([
        row({
          country: 'Vietnam',
          startDate: new Date('2026-08-01T00:00:00Z'),
          endDate: new Date('2026-08-21T00:00:00Z'),
        }),
      ]),
    ).toBe('Vietnam · Aug 2026');
  });

  it('formats a single country spanning two months', () => {
    expect(
      suggestTripName([
        row({
          country: 'Vietnam',
          startDate: new Date('2026-08-01T00:00:00Z'),
          endDate: new Date('2026-09-10T00:00:00Z'),
        }),
      ]),
    ).toBe('Vietnam · Aug–Sep 2026');
  });

  it('formats a single country spanning a year boundary', () => {
    expect(
      suggestTripName([
        row({
          country: 'Vietnam',
          startDate: new Date('2026-12-15T00:00:00Z'),
          endDate: new Date('2027-01-05T00:00:00Z'),
        }),
      ]),
    ).toBe('Vietnam · Dec 2026 – Jan 2027');
  });

  it('joins up to three countries with arrows', () => {
    const rows = [
      row({
        country: 'Vietnam',
        startDate: new Date('2026-08-01T00:00:00Z'),
        endDate: new Date('2026-08-15T00:00:00Z'),
      }),
      row({
        country: 'Cambodia',
        startDate: new Date('2026-08-16T00:00:00Z'),
        endDate: new Date('2026-08-25T00:00:00Z'),
      }),
      row({
        country: 'Laos',
        startDate: new Date('2026-08-26T00:00:00Z'),
        endDate: new Date('2026-09-05T00:00:00Z'),
      }),
    ];
    expect(suggestTripName(rows)).toBe('Vietnam → Cambodia → Laos · Aug–Sep 2026');
  });

  it('collapses four or more countries to "+n more"', () => {
    const rows = [
      row({ country: 'Vietnam' }),
      row({ country: 'Cambodia' }),
      row({ country: 'Laos' }),
      row({ country: 'Thailand' }),
      row({ country: 'Malaysia' }),
    ];
    expect(suggestTripName(rows)).toBe('Vietnam → Cambodia +3 more');
  });

  it('dedupes consecutive entries in the same country', () => {
    const rows = [
      row({ country: 'Vietnam' }),
      row({ country: 'Vietnam', city: 'Saigon' }),
      row({ country: 'Cambodia' }),
    ];
    expect(suggestTripName(rows)).toBe('Vietnam → Cambodia');
  });

  it('omits the date segment when no row has dates', () => {
    expect(suggestTripName([row({ country: 'Vietnam' })])).toBe('Vietnam');
  });
});

describe('suggestTripBudgetPence', () => {
  it('returns null when no row has a suggested budget', () => {
    expect(suggestTripBudgetPence([row({ suggestedBudgetPence: null })])).toBeNull();
  });

  it('sums per-row budgets and adds a 10% contingency rounded up to £100', () => {
    // 100,000 + 200,000 = 300,000; +10% = 330,000; rounded up to nearest £100 (10,000p) = 330,000
    expect(
      suggestTripBudgetPence([
        row({ suggestedBudgetPence: 100_000 }),
        row({ suggestedBudgetPence: 200_000 }),
      ]),
    ).toBe(330_000);
  });

  it('rounds awkward totals up to the nearest £100', () => {
    // 123,456 + 234,567 = 358,023; +10% = 393,825.3; ceil = 393,826; round up to 400,000
    expect(
      suggestTripBudgetPence([
        row({ suggestedBudgetPence: 123_456 }),
        row({ suggestedBudgetPence: 234_567 }),
      ]),
    ).toBe(400_000);
  });

  it('honours a custom contingency ratio', () => {
    // 100,000 +0% = 100,000; rounds to 100,000
    expect(suggestTripBudgetPence([row({ suggestedBudgetPence: 100_000 })], 0)).toBe(100_000);
  });

  it('skips rows with null or zero suggested budgets', () => {
    expect(
      suggestTripBudgetPence([
        row({ suggestedBudgetPence: null }),
        row({ suggestedBudgetPence: 0 }),
        row({ suggestedBudgetPence: 50_000 }),
      ]),
    ).toBe(60_000); // 50,000 +10% = 55,000; rounded up to 60,000
  });
});
