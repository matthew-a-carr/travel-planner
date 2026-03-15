import { describe, expect, it } from 'vitest';
import {
  destinationDays,
  nextSortOrder,
  sortDestinations,
  validateCoordinates,
  validateDateRange,
  validateDestinationEdit,
  validateNewDestination,
} from './destination';
import { money } from '../trip/types';
import type { Destination, Trip, TripFixedCost } from '../trip/types';

// ─── Test fixtures ────────────────────────────────────────────────────────────

function makeTrip(overrides: Partial<Trip> = {}): Trip {
  return {
    id: 'trip-1',
    organizationId: 'org-1',
    ownerId: 'user-1',
    name: 'Round the World 2026',
    totalBudget: money(5_000_000, 'GBP'),
    status: 'planning',
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

function makeFixedCost(amountPence: number): TripFixedCost {
  return {
    id: 'fc-1',
    tripId: 'trip-1',
    label: 'Flights',
    amount: money(amountPence, 'GBP'),
    category: 'other',
    date: new Date('2026-01-01'),
    sortOrder: 0,
    createdAt: new Date('2026-01-01'),
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
    city: null,
    latitude: null,
    longitude: null,
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
  it('should sort by startDate ascending', () => {
    const destinations = [
      makeDestination({ id: 'dest-3', name: 'Australia', startDate: new Date('2026-03-01'), endDate: new Date('2026-03-10') }),
      makeDestination({ id: 'dest-1', name: 'Japan', startDate: new Date('2026-01-01'), endDate: new Date('2026-01-10') }),
      makeDestination({ id: 'dest-2', name: 'Thailand', startDate: new Date('2026-02-01'), endDate: new Date('2026-02-10') }),
    ];
    const sorted = sortDestinations(destinations);
    expect(sorted.map((d) => d.name)).toEqual(['Japan', 'Thailand', 'Australia']);
  });

  it('should place destinations without dates after those with dates', () => {
    const destinations = [
      makeDestination({ id: 'dest-a', name: 'No dates', startDate: null, endDate: null }),
      makeDestination({ id: 'dest-b', name: 'Has dates', startDate: new Date('2026-02-01'), endDate: new Date('2026-02-10') }),
    ];
    const sorted = sortDestinations(destinations);
    expect(sorted.map((d) => d.name)).toEqual(['Has dates', 'No dates']);
  });

  it('should sort dateless destinations by sortOrder then createdAt', () => {
    const destinations = [
      makeDestination({ id: 'dest-b', sortOrder: 1, createdAt: new Date('2026-01-01') }),
      makeDestination({ id: 'dest-a', sortOrder: 0, createdAt: new Date('2026-01-02') }),
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
    const result = validateNewDestination(trip, [], [], destination);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe(destination);
  });

  it('should reject a destination that exceeds available budget after fixed costs', () => {
    const trip = makeTrip({ totalBudget: money(2_000_000, 'GBP') });
    const fixedCosts = [makeFixedCost(1_600_000)]; // £16,000 fixed, £4,000 available
    const destination = makeDestination({ amountPence: 400_001 });
    const result = validateNewDestination(trip, [], fixedCosts, destination);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('exceeds available budget');
  });

  it('should reject a destination with an invalid date range', () => {
    const trip = makeTrip();
    const destination = makeDestination({
      startDate: new Date('2026-07-01'),
      endDate: new Date('2026-06-01'),
    });
    const result = validateNewDestination(trip, [], [], destination);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('Start date must be before end date');
  });

  it('should account for existing destination allocations', () => {
    const trip = makeTrip();
    const fixedCosts = [makeFixedCost(1_600_000)];
    const existing = [makeDestination({ id: 'dest-existing', amountPence: 3_000_000 })];
    // Available = 5,000,000 - 1,600,000 - 3,000,000 = 400,000
    const newDest = makeDestination({ id: 'dest-new', amountPence: 400_001 });
    const result = validateNewDestination(trip, existing, fixedCosts, newDest);
    expect(result.ok).toBe(false);
  });
});

// ─── destinationDays ──────────────────────────────────────────────────────────

describe('destinationDays', () => {
  it('should return null when both dates are null', () => {
    expect(destinationDays({ startDate: null, endDate: null })).toBeNull();
  });

  it('should return null when only start date is set', () => {
    expect(destinationDays({ startDate: new Date('2026-06-01'), endDate: null })).toBeNull();
  });

  it('should return null when only end date is set', () => {
    expect(destinationDays({ startDate: null, endDate: new Date('2026-06-30') })).toBeNull();
  });

  it('should return correct number of days for a one-month span', () => {
    // 1 June → 1 July = 30 days
    const days = destinationDays({
      startDate: new Date('2026-06-01'),
      endDate: new Date('2026-07-01'),
    });
    expect(days).toBe(30);
  });

  it('should return 1 for a single-day stay', () => {
    const days = destinationDays({
      startDate: new Date('2026-06-01'),
      endDate: new Date('2026-06-02'),
    });
    expect(days).toBe(1);
  });

  it('should return correct days for a 45-day stay', () => {
    const start = new Date('2026-09-01');
    const end = new Date('2026-10-16'); // 45 days
    expect(destinationDays({ startDate: start, endDate: end })).toBe(45);
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

// ─── validateDestinationEdit ──────────────────────────────────────────────────
//
// Budget validation uses the delta approach:
//   available = total − fixed − sum(allDestinations)   [existing alloc included]
//   only check when delta > 0; pass delta (not new total) to canAllocateBudget
//
// Trip setup for these tests:
//   total = £10,000  (1_000_000p)
//   fixed = £0
//   Japan (existing, under edit) = £4,000  (400_000p)
//   Thailand (sibling)           = £3,000  (300_000p)
//   available (excl. Japan)      = £3,000  (300_000p)

describe('validateDestinationEdit', () => {
  function makeEditTrip() {
    return makeTrip({ totalBudget: money(1_000_000, 'GBP') });
  }

  const japan = makeDestination({ id: 'dest-japan', amountPence: 400_000 });
  const thailand = makeDestination({ id: 'dest-thailand', amountPence: 300_000 });
  const allDestinations = [japan, thailand];

  it('should accept an edit with no budget change', () => {
    const updated = { ...japan, name: 'Japan — renamed' };
    const result = validateDestinationEdit(makeEditTrip(), allDestinations, [], japan, updated);
    expect(result.ok).toBe(true);
  });

  it('should accept an edit that decreases the budget', () => {
    const updated = { ...japan, estimatedBudget: money(200_000, 'GBP') };
    const result = validateDestinationEdit(makeEditTrip(), allDestinations, [], japan, updated);
    expect(result.ok).toBe(true);
  });

  it('should accept a budget increase that fits within available headroom', () => {
    // delta = 600_000 − 400_000 = 200_000; available = 300_000 → fits
    const updated = { ...japan, estimatedBudget: money(600_000, 'GBP') };
    const result = validateDestinationEdit(makeEditTrip(), allDestinations, [], japan, updated);
    expect(result.ok).toBe(true);
  });

  it('should accept a budget increase that exactly uses all available headroom', () => {
    // delta = 700_000 − 400_000 = 300_000; available = 300_000 → exactly fits
    const updated = { ...japan, estimatedBudget: money(700_000, 'GBP') };
    const result = validateDestinationEdit(makeEditTrip(), allDestinations, [], japan, updated);
    expect(result.ok).toBe(true);
  });

  it('should reject a budget increase that exceeds available headroom', () => {
    // delta = 700_001 − 400_000 = 300_001; available = 300_000 → over by 1p
    const updated = { ...japan, estimatedBudget: money(700_001, 'GBP') };
    const result = validateDestinationEdit(makeEditTrip(), allDestinations, [], japan, updated);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('exceeds available budget');
  });

  it('should reject an edit with an invalid date range', () => {
    const updated = {
      ...japan,
      startDate: new Date('2026-07-01'),
      endDate: new Date('2026-06-01'),
    };
    const result = validateDestinationEdit(makeEditTrip(), allDestinations, [], japan, updated);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('Start date must be before end date');
  });

  it('should accept clearing previously set dates', () => {
    const withDates = {
      ...japan,
      startDate: new Date('2026-06-01'),
      endDate: new Date('2026-07-01'),
    };
    const updated = { ...withDates, startDate: null, endDate: null };
    const result = validateDestinationEdit(makeEditTrip(), allDestinations, [], withDates, updated);
    expect(result.ok).toBe(true);
  });

  it('should account for fixed costs when checking the budget delta', () => {
    // fixed = £5,000; available = 1_000_000 − 500_000 − 700_000 = −200_000 … wait
    // Let's use a cleaner setup: total = £10,000, fixed = £2,000, Japan = £4,000, Thailand = £3,000
    // available = 10,000 − 2,000 − 7,000 = £1,000
    const trip = makeTrip({ totalBudget: money(1_000_000, 'GBP') });
    const fixedCosts = [makeFixedCost(200_000)]; // £2,000 fixed
    // delta = 500_001 − 400_000 = 100_001; available = 300_000 - 200_000 = wait...
    // available = 1_000_000 − 200_000 − (400_000 + 300_000) = 100_000
    // delta = 500_001 − 400_000 = 100_001 > 100_000 → rejected
    const updated = { ...japan, estimatedBudget: money(500_001, 'GBP') };
    const result = validateDestinationEdit(trip, allDestinations, fixedCosts, japan, updated);
    expect(result.ok).toBe(false);
  });
});

// ─── validateCoordinates ─────────────────────────────────────────────────────

describe('validateCoordinates', () => {
  it('should accept valid coordinates', () => {
    const result = validateCoordinates(13.7563, 100.5018);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.latitude).toBe(13.7563);
      expect(result.value.longitude).toBe(100.5018);
    }
  });

  it('should accept boundary values', () => {
    expect(validateCoordinates(90, 180).ok).toBe(true);
    expect(validateCoordinates(-90, -180).ok).toBe(true);
    expect(validateCoordinates(0, 0).ok).toBe(true);
  });

  it('should reject latitude above 90', () => {
    const result = validateCoordinates(90.1, 0);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('Latitude');
  });

  it('should reject latitude below -90', () => {
    const result = validateCoordinates(-90.1, 0);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('Latitude');
  });

  it('should reject longitude above 180', () => {
    const result = validateCoordinates(0, 180.1);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('Longitude');
  });

  it('should reject longitude below -180', () => {
    const result = validateCoordinates(0, -180.1);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('Longitude');
  });
});
