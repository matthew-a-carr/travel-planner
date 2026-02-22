import { describe, it, expect } from 'vitest';
import { validateDateRange, sortDestinations } from './destination';
import type { Destination } from './types';
import { money } from '../trip/types';

function makeDestination(overrides: Partial<Destination> = {}): Destination {
  return {
    id: 'dest-1',
    tripId: 'trip-1',
    name: 'Japan',
    country: 'Japan',
    estimatedBudget: money(500_000, 'GBP'),
    comfortLevel: 'mid',
    startDate: null,
    endDate: null,
    sortOrder: 0,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

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
