import { describe, expect, it } from 'vitest';
import {
  nextSortOrder,
  sortDestinations,
  validateDateRange,
  validateNewDestination,
} from './destination';
import { money } from '../trip/types';
import type { Destination, Trip } from '../trip/types';

// ─── Test fixtures ────────────────────────────────────────────────────────────

function makeTrip(overrides: Partial<Trip> = {}): Trip {
  return {
    id: 'trip-1',
    ownerId: 'user-1',
    name: 'Round the World 2026',
    totalBudget: money(5_000_000, 'GBP'),
    ringfencedAmount: money(1_600_000, 'GBP'),
    ringfencedLabel: 'Australia Visa & Living',
    status: 'planning',
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

function makeDestination(
  overrides: Partial<Destination> & { amountPence?: number } = {},
): Destination {
  const { amountPence = 500_000, ...rest } = overrides;
  return {
    id: 'dest-1',
    tripId: 'trip-1',
    name: 'Japan',
    country: 'Japan',
    estimatedBudget: money(amountPence, 'GBP'),
    comfortLevel: 'mid',
    startDate: null,
    endDate: null,
    sortOrder: 0,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...rest,
  };
}

// ─── validateDateRange ────────────────────────────────────────────────────────

describe('validateDateRange', () => {
  it('should accept when both dates are null', () => {
    const result = validateDateRange({ startDate: null, endDate: null });
    expect(result.ok).toBe(true);
  });

  it('should accept a valid date range', () => {
    const result = validateDateRange({
      startDate: new Date('2026-06-01'),
      endDate: new Date('2026-06-30'),
    });
    expect(result.ok).toBe(true);
  });

  it('should reject when only start date is set', () => {
    const result = validateDateRange({
      startDate: new Date('2026-06-01'),
      endDate: null,
    });
    expect(result.ok).toBe(false);
  });

  it('should reject when only end date is set', () => {
    const result = validateDateRange({
      startDate: null,
      endDate: new Date('2026-06-30'),
    });
    expect(result.ok).toBe(false);
  });

  it('should reject when start date equals end date', () => {
    const sameDate = new Date('2026-06-01');
    const result = validateDateRange({ startDate: sameDate, endDate: sameDate });
    expect(result.ok).toBe(false);
  });

  it('should reject when start date is after end date', () => {
    const result = validateDateRange({
      startDate: new Date('2026-07-01'),
      endDate: new Date('2026-06-01'),
    });
    expect(result.ok).toBe(false);
  });
});

// ─── sortDestinations ─────────────────────────────────────────────────────────

describe('sortDestinations', () => {
  it('should sort by sortOrder ascending', () => {
    const destinations = [
      makeDestination({ id: 'dest-3', sortOrder: 2, name: 'Australia' }),
      makeDestination({ id: 'dest-1', sortOrder: 0, name: 'Japan' }),
      makeDestination({ id: 'dest-2', sortOrder: 1, name: 'Thailand' }),
    ];
    const sorted = sortDestinations(destinations);
    expect(sorted.map((d) => d.name)).toEqual(['Japan', 'Thailand', 'Australia']);
  });

  it('should sort by createdAt as tiebreaker when sortOrder is equal', () => {
    const destinations = [
      makeDestination({ id: 'dest-b', sortOrder: 0, createdAt: new Date('2026-01-02') }),
      makeDestination({ id: 'dest-a', sortOrder: 0, createdAt: new Date('2026-01-01') }),
    ];
    const sorted = sortDestinations(destinations);
    expect(sorted[0]!.id).toBe('dest-a');
    expect(sorted[1]!.id).toBe('dest-b');
  });

  it('should not mutate the original array', () => {
    const destinations = [
      makeDestination({ id: 'dest-2', sortOrder: 1 }),
      makeDestination({ id: 'dest-1', sortOrder: 0 }),
    ];
    const original = [...destinations];
    sortDestinations(destinations);
    expect(destinations).toEqual(original);
  });
});

// ─── validateNewDestination ───────────────────────────────────────────────────

describe('validateNewDestination', () => {
  it('should accept a valid destination that fits in the budget', () => {
    const trip = makeTrip();
    const destination = makeDestination({ amountPence: 1_000_000 });
    const result = validateNewDestination(trip, [], destination);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe(destination);
  });

  it('should reject a destination that exceeds available budget', () => {
    const trip = makeTrip({
      totalBudget: money(2_000_000, 'GBP'),
      ringfencedAmount: money(1_600_000, 'GBP'),
    });
    const destination = makeDestination({ amountPence: 400_001 });
    const result = validateNewDestination(trip, [], destination);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('exceeds available budget');
  });

  it('should reject a destination with an invalid date range', () => {
    const trip = makeTrip();
    const destination = makeDestination({
      startDate: new Date('2026-07-01'),
      endDate: new Date('2026-06-01'),
    });
    const result = validateNewDestination(trip, [], destination);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('Start date must be before end date');
  });

  it('should account for existing destination allocations', () => {
    const trip = makeTrip();
    const existing = [makeDestination({ id: 'dest-existing', amountPence: 3_000_000 })];
    // Available = 5,000,000 - 1,600,000 - 3,000,000 = 400,000
    const newDest = makeDestination({ id: 'dest-new', amountPence: 400_001 });
    const result = validateNewDestination(trip, existing, newDest);
    expect(result.ok).toBe(false);
  });
});

// ─── nextSortOrder ────────────────────────────────────────────────────────────

describe('nextSortOrder', () => {
  it('should return 0 for an empty list', () => {
    expect(nextSortOrder([])).toBe(0);
  });

  it('should return one more than the highest sort order', () => {
    const destinations = [
      makeDestination({ sortOrder: 0 }),
      makeDestination({ sortOrder: 3 }),
      makeDestination({ sortOrder: 1 }),
    ];
    expect(nextSortOrder(destinations)).toBe(4);
  });
});
