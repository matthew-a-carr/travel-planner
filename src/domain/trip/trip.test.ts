import { describe, expect, it } from 'vitest';
import {
  buildBudgetWaterfall,
  calculateAllocatedBudget,
  calculateAvailableBudget,
  calculateTotalFixedCosts,
  canAllocateBudget,
  getTripBudgetSummary,
  validateTripBudgetEdit,
} from './trip';
import type { Destination, Trip, TripFixedCost } from './types';
import { moneyUnchecked as money } from './types';

// ─── Test fixtures ────────────────────────────────────────────────────────────

function makeTrip(overrides: Partial<Trip> = {}): Trip {
  return {
    id: 'trip-1',
    organizationId: 'org-1',
    ownerId: 'user-1',
    name: 'Round the World 2026',
    totalBudget: money(5_000_000, 'GBP'), // £50,000
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

function makeFixedCost(
  overrides: Partial<TripFixedCost> & { amountPence?: number } = {},
): TripFixedCost {
  const { amountPence = 100_000, ...rest } = overrides; // default £1,000
  return {
    id: 'fc-1',
    tripId: 'trip-1',
    label: 'Flights',
    amount: money(amountPence, 'GBP'),
    category: 'other',
    date: new Date('2026-01-01'),
    sortOrder: 0,
    createdAt: new Date('2026-01-01'),
    ...rest,
  };
}

// ─── calculateTotalFixedCosts ─────────────────────────────────────────────────

describe('calculateTotalFixedCosts', () => {
  it('should return zero for an empty list', () => {
    const result = calculateTotalFixedCosts([]);
    expect(result.amountPence).toBe(0);
  });

  it('should sum a single fixed cost', () => {
    const result = calculateTotalFixedCosts([makeFixedCost({ amountPence: 95_000 })]);
    expect(result.amountPence).toBe(95_000);
  });

  it('should sum multiple fixed costs', () => {
    const fixedCosts = [
      makeFixedCost({ id: 'fc-1', amountPence: 95_000 }),
      makeFixedCost({ id: 'fc-2', label: 'Insurance', amountPence: 20_000 }),
      makeFixedCost({ id: 'fc-3', label: 'Phone', amountPence: 24_000 }),
    ];
    const result = calculateTotalFixedCosts(fixedCosts);
    expect(result.amountPence).toBe(139_000);
  });

  it('should return GBP currency', () => {
    const result = calculateTotalFixedCosts([makeFixedCost({ amountPence: 1_000 })]);
    expect(result.currency).toBe('GBP');
  });

  it('should sum fixed costs with new categories (eating-out, subscriptions, healthcare, visas)', () => {
    const fixedCosts = [
      makeFixedCost({ id: 'fc-1', label: 'Restaurants', category: 'eating-out', amountPence: 50_000 }),
      makeFixedCost({ id: 'fc-2', label: 'Netflix', category: 'subscriptions', amountPence: 6_000 }),
      makeFixedCost({ id: 'fc-3', label: 'Vaccinations', category: 'healthcare', amountPence: 15_000 }),
      makeFixedCost({ id: 'fc-4', label: 'Tourist Visa', category: 'visas', amountPence: 10_000 }),
    ];
    const result = calculateTotalFixedCosts(fixedCosts);
    expect(result.amountPence).toBe(81_000);
  });
});

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
      makeDestination({ id: 'dest-1', amountPence: 500_000 }),
      makeDestination({ id: 'dest-2', amountPence: 300_000 }),
      makeDestination({ id: 'dest-3', amountPence: 200_000 }),
    ];
    const result = calculateAllocatedBudget(trip, destinations);
    expect(result.amountPence).toBe(1_000_000);
  });

  it('should only count destinations belonging to the given trip', () => {
    const trip = makeTrip({ id: 'trip-1' });
    const destinations = [
      makeDestination({ id: 'dest-1', tripId: 'trip-1', amountPence: 500_000 }),
      makeDestination({ id: 'dest-2', tripId: 'trip-2', amountPence: 999_999 }),
    ];
    const result = calculateAllocatedBudget(trip, destinations);
    expect(result.amountPence).toBe(500_000);
  });
});

// ─── calculateAvailableBudget ─────────────────────────────────────────────────

describe('calculateAvailableBudget', () => {
  it('should subtract fixed costs from total when no destinations', () => {
    const trip = makeTrip({ totalBudget: money(5_000_000, 'GBP') });
    const fixedCosts = [makeFixedCost({ amountPence: 1_600_000 })];
    const result = calculateAvailableBudget(trip, [], fixedCosts);
    expect(result.amountPence).toBe(3_400_000);
  });

  it('should subtract fixed costs and allocated amounts from total', () => {
    const trip = makeTrip({ totalBudget: money(5_000_000, 'GBP') });
    const fixedCosts = [makeFixedCost({ amountPence: 1_600_000 })];
    const destinations = [makeDestination({ amountPence: 1_000_000 })];
    const result = calculateAvailableBudget(trip, destinations, fixedCosts);
    expect(result.amountPence).toBe(2_400_000);
  });

  it('should sum multiple fixed costs', () => {
    const trip = makeTrip({ totalBudget: money(5_000_000, 'GBP') });
    const fixedCosts = [
      makeFixedCost({ id: 'fc-1', amountPence: 1_000_000 }),
      makeFixedCost({ id: 'fc-2', amountPence: 600_000 }),
    ];
    const result = calculateAvailableBudget(trip, [], fixedCosts);
    expect(result.amountPence).toBe(3_400_000);
  });

  it('should return negative value when over-allocated', () => {
    const trip = makeTrip({ totalBudget: money(2_000_000, 'GBP') });
    const fixedCosts = [makeFixedCost({ amountPence: 1_600_000 })];
    const destinations = [makeDestination({ amountPence: 1_000_000 })];
    const result = calculateAvailableBudget(trip, destinations, fixedCosts);
    expect(result.amountPence).toBe(-600_000);
  });

  it('should return full total when no fixed costs and no destinations', () => {
    const trip = makeTrip({ totalBudget: money(5_000_000, 'GBP') });
    const result = calculateAvailableBudget(trip, [], []);
    expect(result.amountPence).toBe(5_000_000);
  });
});

// ─── canAllocateBudget ────────────────────────────────────────────────────────

describe('canAllocateBudget', () => {
  it('should allow allocation that fits within available budget', () => {
    const trip = makeTrip({ totalBudget: money(5_000_000, 'GBP') });
    const fixedCosts = [makeFixedCost({ amountPence: 1_600_000 })];
    const result = canAllocateBudget(trip, [], fixedCosts, money(3_000_000, 'GBP'));
    expect(result.ok).toBe(true);
  });

  it('should allow allocation that exactly matches available budget', () => {
    const trip = makeTrip({ totalBudget: money(5_000_000, 'GBP') });
    const fixedCosts = [makeFixedCost({ amountPence: 1_600_000 })];
    const result = canAllocateBudget(trip, [], fixedCosts, money(3_400_000, 'GBP'));
    expect(result.ok).toBe(true);
  });

  it('should reject allocation exceeding available budget', () => {
    const trip = makeTrip({ totalBudget: money(5_000_000, 'GBP') });
    const fixedCosts = [makeFixedCost({ amountPence: 1_600_000 })];
    const result = canAllocateBudget(trip, [], fixedCosts, money(3_400_001, 'GBP'));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('exceeds available budget');
  });

  it('should account for existing destination allocations', () => {
    const trip = makeTrip({ totalBudget: money(5_000_000, 'GBP') });
    const fixedCosts = [makeFixedCost({ amountPence: 1_600_000 })];
    const existing = [makeDestination({ amountPence: 2_000_000 })];
    const result = canAllocateBudget(trip, existing, fixedCosts, money(1_400_001, 'GBP'));
    expect(result.ok).toBe(false);
  });

  it('should reject negative allocation amount', () => {
    const trip = makeTrip();
    const result = canAllocateBudget(trip, [], [], money(-1, 'GBP'));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('negative');
  });

  it('should allow zero allocation', () => {
    const trip = makeTrip();
    const result = canAllocateBudget(trip, [], [], money(0, 'GBP'));
    expect(result.ok).toBe(true);
  });

  it('should treat total fixed costs as unavailable for destinations', () => {
    const trip = makeTrip({ totalBudget: money(1_600_000, 'GBP') });
    const fixedCosts = [makeFixedCost({ amountPence: 1_600_000 })];
    const result = canAllocateBudget(trip, [], fixedCosts, money(1, 'GBP'));
    expect(result.ok).toBe(false);
  });
});

// ─── validateTripBudgetEdit ───────────────────────────────────────────────────

describe('validateTripBudgetEdit', () => {
  it('should return ok when there are no destinations or fixed costs', () => {
    const result = validateTripBudgetEdit(1_000_000, [], []);
    expect(result.ok).toBe(true);
  });

  it('should return ok when new budget exactly covers destinations and fixed costs', () => {
    const destinations = [makeDestination({ amountPence: 1_000_000 })];
    const fixedCosts = [makeFixedCost({ amountPence: 600_000 })];
    // exactly 1,600,000
    const result = validateTripBudgetEdit(1_600_000, destinations, fixedCosts);
    expect(result.ok).toBe(true);
  });

  it('should return ok when new budget exceeds total allocations', () => {
    const destinations = [makeDestination({ amountPence: 500_000 })];
    const fixedCosts = [makeFixedCost({ amountPence: 200_000 })];
    const result = validateTripBudgetEdit(1_000_000, destinations, fixedCosts);
    expect(result.ok).toBe(true);
  });

  it('should return err when new budget is below sum of destinations and fixed costs', () => {
    const destinations = [makeDestination({ amountPence: 1_000_000 })];
    const fixedCosts = [makeFixedCost({ amountPence: 600_000 })];
    const result = validateTripBudgetEdit(1_599_999, destinations, fixedCosts);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/too small|reduce fixed costs/i);
    }
  });

  it('should return err when fixed costs alone exceed new budget', () => {
    const fixedCosts = [makeFixedCost({ amountPence: 1_600_000 })];
    const result = validateTripBudgetEdit(500_000, [], fixedCosts);
    expect(result.ok).toBe(false);
  });

  it('should sum multiple destinations', () => {
    const destinations = [
      makeDestination({ id: 'dest-1', amountPence: 500_000 }),
      makeDestination({ id: 'dest-2', amountPence: 500_000 }),
    ];
    // 1,000,000 destinations, no fixed costs — needs at least 1,000,000
    const result = validateTripBudgetEdit(999_999, destinations, []);
    expect(result.ok).toBe(false);
  });
});

// ─── getTripBudgetSummary ─────────────────────────────────────────────────────

describe('getTripBudgetSummary', () => {
  it('should return correct summary for a trip with fixed costs and destinations', () => {
    const trip = makeTrip({ totalBudget: money(5_000_000, 'GBP') });
    const fixedCosts = [makeFixedCost({ amountPence: 1_600_000 })];
    const destinations = [makeDestination({ amountPence: 1_000_000 })];
    const summary = getTripBudgetSummary(trip, destinations, fixedCosts);

    expect(summary.total.amountPence).toBe(5_000_000);
    expect(summary.totalFixed.amountPence).toBe(1_600_000);
    expect(summary.allocated.amountPence).toBe(1_000_000);
    expect(summary.available.amountPence).toBe(2_400_000);
    expect(summary.isOverAllocated).toBe(false);
    expect(summary.fixedCosts).toHaveLength(1);
  });

  it('should flag as over-allocated when budget is exceeded', () => {
    const trip = makeTrip({ totalBudget: money(2_000_000, 'GBP') });
    const fixedCosts = [makeFixedCost({ amountPence: 1_600_000 })];
    const destinations = [makeDestination({ amountPence: 1_000_000 })];
    const summary = getTripBudgetSummary(trip, destinations, fixedCosts);
    expect(summary.isOverAllocated).toBe(true);
  });

  it('should calculate allocation percentage correctly', () => {
    const trip = makeTrip({ totalBudget: money(10_000_000, 'GBP') });
    const destinations = [makeDestination({ amountPence: 5_000_000 })]; // 50%
    const summary = getTripBudgetSummary(trip, destinations, []);
    expect(summary.allocationPercentage).toBe(50);
  });

  it('should include fixed costs in allocation percentage', () => {
    const trip = makeTrip({ totalBudget: money(10_000_000, 'GBP') });
    const fixedCosts = [makeFixedCost({ amountPence: 2_000_000 })]; // 20%
    const destinations = [makeDestination({ amountPence: 3_000_000 })]; // 30%
    const summary = getTripBudgetSummary(trip, destinations, fixedCosts);
    expect(summary.allocationPercentage).toBe(50);
  });
});

// ─── buildBudgetWaterfall ───────────────────────────────────────────────────

describe('buildBudgetWaterfall', () => {
  it('should produce a waterfall with fixed costs and destinations', () => {
    const trip = makeTrip({ totalBudget: money(1_000_000, 'GBP') }); // £10,000
    const fixedCosts = [makeFixedCost({ amountPence: 200_000 })]; // £2,000
    const destinations = [
      makeDestination({ id: 'dest-1', name: 'Bangkok', amountPence: 150_000, city: 'Bangkok', latitude: 13.75, longitude: 100.5, sortOrder: 0 }),
      makeDestination({ id: 'dest-2', name: 'Chiang Mai', amountPence: 80_000, city: 'Chiang Mai', latitude: 18.79, longitude: 98.98, sortOrder: 1 }),
    ];
    const spend = new Map([['dest-1', 120_000], ['dest-2', 90_000]]);

    const waterfall = buildBudgetWaterfall(trip, destinations, fixedCosts, spend);

    expect(waterfall.startingBudgetPence).toBe(1_000_000);
    expect(waterfall.stops).toHaveLength(3);

    // Fixed costs stop
    expect(waterfall.stops[0]!.type).toBe('fixed-costs');
    expect(waterfall.stops[0]!.allocatedPence).toBe(200_000);
    expect(waterfall.stops[0]!.runningTotalPence).toBe(800_000);

    // Bangkok stop
    expect(waterfall.stops[1]!.type).toBe('destination');
    expect(waterfall.stops[1]!.label).toBe('Bangkok, Japan');
    expect(waterfall.stops[1]!.allocatedPence).toBe(150_000);
    expect(waterfall.stops[1]!.spentPence).toBe(120_000);
    expect(waterfall.stops[1]!.runningTotalPence).toBe(650_000);
    expect(waterfall.stops[1]!.isOverBudget).toBe(false);
    expect(waterfall.stops[1]!.coordinates).toEqual({ latitude: 13.75, longitude: 100.5 });

    // Chiang Mai stop — over budget (spent 90k vs 80k allocated)
    expect(waterfall.stops[2]!.type).toBe('destination');
    expect(waterfall.stops[2]!.spentPence).toBe(90_000);
    expect(waterfall.stops[2]!.isOverBudget).toBe(true);
    expect(waterfall.stops[2]!.runningTotalPence).toBe(570_000);

    expect(waterfall.unallocatedPence).toBe(570_000);
  });

  it('should handle empty destinations (only fixed costs)', () => {
    const trip = makeTrip({ totalBudget: money(500_000, 'GBP') });
    const fixedCosts = [makeFixedCost({ amountPence: 100_000 })];

    const waterfall = buildBudgetWaterfall(trip, [], fixedCosts, new Map());

    expect(waterfall.stops).toHaveLength(1);
    expect(waterfall.stops[0]!.type).toBe('fixed-costs');
    expect(waterfall.unallocatedPence).toBe(400_000);
  });

  it('should handle zero fixed costs', () => {
    const trip = makeTrip({ totalBudget: money(500_000, 'GBP') });
    const destinations = [makeDestination({ id: 'dest-1', amountPence: 300_000 })];

    const waterfall = buildBudgetWaterfall(trip, destinations, [], new Map());

    expect(waterfall.stops).toHaveLength(2);
    expect(waterfall.stops[0]!.type).toBe('fixed-costs');
    expect(waterfall.stops[0]!.allocatedPence).toBe(0);
    expect(waterfall.stops[0]!.runningTotalPence).toBe(500_000);
    expect(waterfall.stops[1]!.runningTotalPence).toBe(200_000);
    expect(waterfall.unallocatedPence).toBe(200_000);
  });

  it('should use destination name when city is null', () => {
    const trip = makeTrip({ totalBudget: money(500_000, 'GBP') });
    const destinations = [makeDestination({ id: 'dest-1', name: 'Japan', city: null, amountPence: 100_000 })];

    const waterfall = buildBudgetWaterfall(trip, destinations, [], new Map());

    expect(waterfall.stops[1]!.label).toBe('Japan');
  });

  it('should set coordinates to null when destination has no lat/lng', () => {
    const trip = makeTrip({ totalBudget: money(500_000, 'GBP') });
    const destinations = [makeDestination({ id: 'dest-1', amountPence: 100_000, latitude: null, longitude: null })];

    const waterfall = buildBudgetWaterfall(trip, destinations, [], new Map());

    expect(waterfall.stops[1]!.coordinates).toBeNull();
  });

  it('should clamp unallocated to zero when over-allocated', () => {
    const trip = makeTrip({ totalBudget: money(100_000, 'GBP') });
    const destinations = [makeDestination({ id: 'dest-1', amountPence: 200_000 })];

    const waterfall = buildBudgetWaterfall(trip, destinations, [], new Map());

    expect(waterfall.stops[1]!.runningTotalPence).toBe(-100_000);
    expect(waterfall.unallocatedPence).toBe(0);
  });
});
