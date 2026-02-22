import { describe, it, expect } from 'vitest';
import {
  calculateAvailableBudget,
  calculateAllocatedBudget,
  canAllocateBudget,
  getTripBudgetSummary,
} from './trip';
import type { Trip, Destination } from './types';
import { money } from './types';

// ─── Test fixtures ────────────────────────────────────────────────────────────

function makeTrip(overrides: Partial<Trip> = {}): Trip {
  return {
    id: 'trip-1',
    ownerId: 'user-1',
    name: 'Round the World 2026',
    totalBudget: money(5_000_000, 'GBP'), // £50,000
    ringfencedAmount: money(1_600_000, 'GBP'), // £16,000 Australia
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
  const { amountPence = 500_000, ...rest } = overrides; // default £5,000
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

// ─── calculateAllocatedBudget ─────────────────────────────────────────────────

describe('calculateAllocatedBudget', () => {
  it('should return zero when there are no destinations', () => {
    const trip = makeTrip();
    const result = calculateAllocatedBudget(trip, []);
    expect(result.amountPence).toBe(0);
    expect(result.currency).toBe('GBP');
  });

  it('should sum estimated budgets across all trip destinations', () => {
    const trip = makeTrip();
    const destinations = [
      makeDestination({ id: 'dest-1', amountPence: 500_000 }), // £5,000
      makeDestination({ id: 'dest-2', amountPence: 300_000 }), // £3,000
      makeDestination({ id: 'dest-3', amountPence: 200_000 }), // £2,000
    ];
    const result = calculateAllocatedBudget(trip, destinations);
    expect(result.amountPence).toBe(1_000_000); // £10,000
  });

  it('should only count destinations belonging to the given trip', () => {
    const trip = makeTrip({ id: 'trip-1' });
    const destinations = [
      makeDestination({ id: 'dest-1', tripId: 'trip-1', amountPence: 500_000 }),
      makeDestination({ id: 'dest-2', tripId: 'trip-2', amountPence: 999_999 }), // different trip
    ];
    const result = calculateAllocatedBudget(trip, destinations);
    expect(result.amountPence).toBe(500_000);
  });
});

// ─── calculateAvailableBudget ─────────────────────────────────────────────────

describe('calculateAvailableBudget', () => {
  it('should subtract ringfenced amount from total when no destinations', () => {
    const trip = makeTrip({
      totalBudget: money(5_000_000, 'GBP'),   // £50,000
      ringfencedAmount: money(1_600_000, 'GBP'), // £16,000
    });
    const result = calculateAvailableBudget(trip, []);
    expect(result.amountPence).toBe(3_400_000); // £34,000
  });

  it('should subtract ringfenced and allocated amounts from total', () => {
    const trip = makeTrip({
      totalBudget: money(5_000_000, 'GBP'),     // £50,000
      ringfencedAmount: money(1_600_000, 'GBP'), // £16,000
    });
    const destinations = [
      makeDestination({ amountPence: 1_000_000 }), // £10,000
    ];
    const result = calculateAvailableBudget(trip, destinations);
    expect(result.amountPence).toBe(2_400_000); // £24,000
  });

  it('should return negative value when over-allocated', () => {
    const trip = makeTrip({
      totalBudget: money(2_000_000, 'GBP'),     // £20,000
      ringfencedAmount: money(1_600_000, 'GBP'), // £16,000
    });
    const destinations = [
      makeDestination({ amountPence: 1_000_000 }), // £10,000 — exceeds available £4,000
    ];
    const result = calculateAvailableBudget(trip, destinations);
    expect(result.amountPence).toBe(-600_000); // -£6,000
  });

  it('should preserve currency from the trip total budget', () => {
    const trip = makeTrip({
      totalBudget: money(5_000_000, 'GBP'),
      ringfencedAmount: money(0, 'GBP'),
    });
    const result = calculateAvailableBudget(trip, []);
    expect(result.currency).toBe('GBP');
  });
});

// ─── canAllocateBudget ────────────────────────────────────────────────────────

describe('canAllocateBudget', () => {
  it('should allow allocation that fits within available budget', () => {
    const trip = makeTrip({
      totalBudget: money(5_000_000, 'GBP'),
      ringfencedAmount: money(1_600_000, 'GBP'),
    });
    // Available = 5,000,000 - 1,600,000 = 3,400,000
    const result = canAllocateBudget(trip, [], money(3_000_000, 'GBP'));
    expect(result.ok).toBe(true);
  });

  it('should allow allocation that exactly matches available budget', () => {
    const trip = makeTrip({
      totalBudget: money(5_000_000, 'GBP'),
      ringfencedAmount: money(1_600_000, 'GBP'),
    });
    // Available = 3,400,000
    const result = canAllocateBudget(trip, [], money(3_400_000, 'GBP'));
    expect(result.ok).toBe(true);
  });

  it('should reject allocation exceeding available budget', () => {
    const trip = makeTrip({
      totalBudget: money(5_000_000, 'GBP'),
      ringfencedAmount: money(1_600_000, 'GBP'),
    });
    // Available = 3,400,000 but requesting 3,400,001
    const result = canAllocateBudget(trip, [], money(3_400_001, 'GBP'));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('exceeds available budget');
    }
  });

  it('should account for existing destination allocations', () => {
    const trip = makeTrip({
      totalBudget: money(5_000_000, 'GBP'),
      ringfencedAmount: money(1_600_000, 'GBP'),
    });
    const existingDestinations = [
      makeDestination({ amountPence: 2_000_000 }), // £20,000 already allocated
    ];
    // Available = 5,000,000 - 1,600,000 - 2,000,000 = 1,400,000
    const result = canAllocateBudget(
      trip,
      existingDestinations,
      money(1_400_001, 'GBP'), // £1 over
    );
    expect(result.ok).toBe(false);
  });

  it('should reject negative allocation amount', () => {
    const trip = makeTrip();
    const result = canAllocateBudget(trip, [], money(-1, 'GBP'));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('negative');
    }
  });

  it('should allow zero allocation', () => {
    const trip = makeTrip();
    const result = canAllocateBudget(trip, [], money(0, 'GBP'));
    expect(result.ok).toBe(true);
  });

  it('should treat ringfenced amount as unavailable for destinations', () => {
    const trip = makeTrip({
      totalBudget: money(1_600_000, 'GBP'), // £16,000 — exactly the ringfenced amount
      ringfencedAmount: money(1_600_000, 'GBP'),
    });
    // Available = 0
    const result = canAllocateBudget(trip, [], money(1, 'GBP'));
    expect(result.ok).toBe(false);
  });
});

// ─── getTripBudgetSummary ─────────────────────────────────────────────────────

describe('getTripBudgetSummary', () => {
  it('should return correct summary for a trip with destinations', () => {
    const trip = makeTrip({
      totalBudget: money(5_000_000, 'GBP'),
      ringfencedAmount: money(1_600_000, 'GBP'),
    });
    const destinations = [
      makeDestination({ amountPence: 1_000_000 }),
    ];
    const summary = getTripBudgetSummary(trip, destinations);

    expect(summary.total.amountPence).toBe(5_000_000);
    expect(summary.ringfenced.amountPence).toBe(1_600_000);
    expect(summary.allocated.amountPence).toBe(1_000_000);
    expect(summary.available.amountPence).toBe(2_400_000);
    expect(summary.isOverAllocated).toBe(false);
  });

  it('should flag as over-allocated when budget is exceeded', () => {
    const trip = makeTrip({
      totalBudget: money(2_000_000, 'GBP'),
      ringfencedAmount: money(1_600_000, 'GBP'),
    });
    const destinations = [
      makeDestination({ amountPence: 1_000_000 }),
    ];
    const summary = getTripBudgetSummary(trip, destinations);
    expect(summary.isOverAllocated).toBe(true);
  });

  it('should calculate allocation percentage correctly', () => {
    const trip = makeTrip({
      totalBudget: money(10_000_000, 'GBP'),
      ringfencedAmount: money(0, 'GBP'),
    });
    const destinations = [
      makeDestination({ amountPence: 5_000_000 }), // 50%
    ];
    const summary = getTripBudgetSummary(trip, destinations);
    expect(summary.allocationPercentage).toBe(50);
  });
});
