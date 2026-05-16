import { describe, expect, it } from 'vitest';
import type { CountryReference } from '../country-reference/types';
import type { Destination } from '../trip/types';
import { moneyUnchecked } from '../trip/types';
import {
  detectDeterministicFindings,
  detectGaps,
  detectOverlaps,
  flagBudgetVsReference,
  mergeFindings,
  timelineDateRange,
} from './timeline';

function makeDestination(overrides: Partial<Destination> & { id: string }): Destination {
  return {
    tripId: 'trip-1',
    name: `dest-${overrides.id}`,
    country: 'Vietnam',
    city: null,
    latitude: null,
    longitude: null,
    estimatedBudget: moneyUnchecked(100_000, 'GBP'),
    comfortLevel: 'mid',
    startDate: null,
    endDate: null,
    sortOrder: 0,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

const vietnamReference: CountryReference = {
  country: 'Vietnam',
  alpha2: 'VN',
  alpha3: 'VNM',
  region: 'Asia',
  subregion: 'South-Eastern Asia',
  avgDailyCostPence: 5_000,
  currency: 'GBP',
  source: 'manual',
};

describe('detectGaps', () => {
  it('flags multi-day gaps between consecutive dated destinations', () => {
    const a = makeDestination({
      id: 'a',
      name: 'Hanoi',
      startDate: new Date('2026-08-01'),
      endDate: new Date('2026-08-10'),
    });
    const b = makeDestination({
      id: 'b',
      name: 'Phnom Penh',
      startDate: new Date('2026-08-15'),
      endDate: new Date('2026-08-22'),
    });
    const findings = detectGaps([a, b]);
    expect(findings).toHaveLength(1);
    expect(findings[0].kind).toBe('gap');
    expect(findings[0].stopId).toBe('b');
    expect(findings[0].message).toContain('5-day gap');
  });

  it('escalates severity for gaps longer than a week', () => {
    const a = makeDestination({
      id: 'a',
      name: 'Hanoi',
      startDate: new Date('2026-08-01'),
      endDate: new Date('2026-08-05'),
    });
    const b = makeDestination({
      id: 'b',
      name: 'Phnom Penh',
      startDate: new Date('2026-08-20'),
      endDate: new Date('2026-08-25'),
    });
    expect(detectGaps([a, b])[0].severity).toBe('warning');
  });

  it('ignores back-to-back destinations', () => {
    const a = makeDestination({
      id: 'a',
      startDate: new Date('2026-08-01'),
      endDate: new Date('2026-08-10'),
    });
    const b = makeDestination({
      id: 'b',
      startDate: new Date('2026-08-10'),
      endDate: new Date('2026-08-15'),
    });
    expect(detectGaps([a, b])).toEqual([]);
  });

  it('ignores undated destinations', () => {
    expect(detectGaps([makeDestination({ id: 'a' })])).toEqual([]);
  });
});

describe('detectOverlaps', () => {
  it('flags overlapping destinations', () => {
    const a = makeDestination({
      id: 'a',
      name: 'Hanoi',
      startDate: new Date('2026-08-01'),
      endDate: new Date('2026-08-10'),
    });
    const b = makeDestination({
      id: 'b',
      name: 'Saigon',
      startDate: new Date('2026-08-08'),
      endDate: new Date('2026-08-15'),
    });
    const findings = detectOverlaps([a, b]);
    expect(findings).toHaveLength(1);
    expect(findings[0].kind).toBe('overlap');
    expect(findings[0].severity).toBe('danger');
    expect(findings[0].message).toContain('overlap by 2 days');
  });

  it('does not flag adjacent destinations', () => {
    const a = makeDestination({
      id: 'a',
      startDate: new Date('2026-08-01'),
      endDate: new Date('2026-08-10'),
    });
    const b = makeDestination({
      id: 'b',
      startDate: new Date('2026-08-10'),
      endDate: new Date('2026-08-15'),
    });
    expect(detectOverlaps([a, b])).toEqual([]);
  });
});

describe('flagBudgetVsReference', () => {
  const days = 10;

  it('flags a destination budgeted well below the reference', () => {
    const dest = makeDestination({
      id: 'a',
      name: 'Hanoi',
      country: 'Vietnam',
      startDate: new Date('2026-08-01'),
      endDate: new Date(`2026-08-${10 + 1}`),
      estimatedBudget: moneyUnchecked(20_000, 'GBP'), // ~£200 vs ~£500 suggested
    });
    const findings = flagBudgetVsReference([dest], [vietnamReference]);
    expect(findings).toHaveLength(1);
    expect(findings[0].kind).toBe('budget-low');
    expect(findings[0].severity).toBe('warning');
  });

  it('flags a destination budgeted well above the reference', () => {
    const dest = makeDestination({
      id: 'a',
      name: 'Hanoi',
      country: 'Vietnam',
      startDate: new Date('2026-08-01'),
      endDate: new Date(`2026-08-${days + 1}`),
      estimatedBudget: moneyUnchecked(150_000, 'GBP'),
    });
    const findings = flagBudgetVsReference([dest], [vietnamReference]);
    expect(findings).toHaveLength(1);
    expect(findings[0].kind).toBe('budget-high');
  });

  it('does not flag a destination within the tolerance band', () => {
    const dest = makeDestination({
      id: 'a',
      country: 'Vietnam',
      startDate: new Date('2026-08-01'),
      endDate: new Date(`2026-08-${days + 1}`),
      estimatedBudget: moneyUnchecked(50_000, 'GBP'),
    });
    expect(flagBudgetVsReference([dest], [vietnamReference])).toEqual([]);
  });

  it('skips destinations with no matching reference', () => {
    const dest = makeDestination({
      id: 'a',
      country: 'Atlantis',
      startDate: new Date('2026-08-01'),
      endDate: new Date('2026-08-10'),
    });
    expect(flagBudgetVsReference([dest], [vietnamReference])).toEqual([]);
  });
});

describe('mergeFindings', () => {
  it('dedupes by (stopId, kind), keeping the first', () => {
    const a = {
      stopId: 'd1',
      severity: 'warning' as const,
      kind: 'gap' as const,
      message: 'first',
      suggestion: null,
    };
    const b = { ...a, message: 'second' };
    const merged = mergeFindings([a], [b]);
    expect(merged).toHaveLength(1);
    expect(merged[0].message).toBe('first');
  });

  it('combines findings of different kinds for the same stop', () => {
    const a = {
      stopId: 'd1',
      severity: 'info' as const,
      kind: 'gap' as const,
      message: 'gap',
      suggestion: null,
    };
    const b = {
      stopId: 'd1',
      severity: 'info' as const,
      kind: 'seasonality' as const,
      message: 'wet season',
      suggestion: null,
    };
    expect(mergeFindings([a], [b])).toHaveLength(2);
  });
});

describe('timelineDateRange', () => {
  it('returns null when no destinations are dated', () => {
    expect(timelineDateRange([makeDestination({ id: 'a' })])).toBeNull();
  });

  it('returns the min start and max end across dated destinations', () => {
    const a = makeDestination({
      id: 'a',
      startDate: new Date('2026-08-01'),
      endDate: new Date('2026-08-10'),
    });
    const b = makeDestination({
      id: 'b',
      startDate: new Date('2026-09-01'),
      endDate: new Date('2026-09-15'),
    });
    const range = timelineDateRange([a, b]);
    expect(range).not.toBeNull();
    expect(range?.start.toISOString().slice(0, 10)).toBe('2026-08-01');
    expect(range?.end.toISOString().slice(0, 10)).toBe('2026-09-15');
  });
});

describe('detectDeterministicFindings', () => {
  it('aggregates gap, overlap, and budget findings', () => {
    const a = makeDestination({
      id: 'a',
      name: 'Hanoi',
      country: 'Vietnam',
      startDate: new Date('2026-08-01'),
      endDate: new Date('2026-08-11'),
      estimatedBudget: moneyUnchecked(20_000, 'GBP'),
    });
    const b = makeDestination({
      id: 'b',
      name: 'Saigon',
      country: 'Vietnam',
      startDate: new Date('2026-08-20'),
      endDate: new Date('2026-08-25'),
      estimatedBudget: moneyUnchecked(30_000, 'GBP'),
    });
    const findings = detectDeterministicFindings([a, b], [vietnamReference]);
    const kinds = findings.map((f) => f.kind).sort();
    expect(kinds).toContain('gap');
    expect(kinds).toContain('budget-low');
  });
});
