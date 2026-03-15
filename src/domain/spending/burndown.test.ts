import { describe, expect, it } from 'vitest';
import type { Destination, SpendEntry, Trip } from '../trip/types';
import { money } from '../trip/types';
import {
  calculateBurndownProjection,
  calculateDailyPace,
  calculateTargetPace,
  calculateTripBurndown,
  detectAlerts,
} from './burndown';

// ─── Test helpers ────────────────────────────────────────────────────────────

function makeSpendEntry(overrides: Partial<SpendEntry> = {}): SpendEntry {
  return {
    id: 'entry-1',
    destinationId: 'dest-1',
    amount: money(5_000, 'GBP'), // £50
    category: 'food',
    description: null,
    spentAt: new Date('2026-06-05'),
    createdAt: new Date('2026-06-05'),
    ...overrides,
  };
}

function makeDestination(overrides: Partial<Destination> = {}): Destination {
  return {
    id: 'dest-1',
    tripId: 'trip-1',
    name: 'Thailand',
    country: 'Thailand',
    city: null,
    latitude: null,
    longitude: null,
    estimatedBudget: money(100_000, 'GBP'), // £1,000
    comfortLevel: 'mid',
    startDate: new Date('2026-06-01'),
    endDate: new Date('2026-07-01'),
    sortOrder: 0,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

function makeTrip(overrides: Partial<Trip> = {}): Trip {
  return {
    id: 'trip-1',
    organizationId: 'org-1',
    ownerId: 'user-1',
    name: 'Asia Trip',
    totalBudget: money(500_000, 'GBP'), // £5,000
    status: 'active',
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

// ─── calculateDailyPace ─────────────────────────────────────────────────────

describe('calculateDailyPace', () => {
  it('should return 0 when there are no entries', () => {
    const result = calculateDailyPace(
      [],
      new Date('2026-06-01'),
      new Date('2026-06-11'),
    );
    expect(result).toBe(0);
  });

  it('should return 0 when current date is before or equal to start date', () => {
    const entries = [makeSpendEntry()];
    const result = calculateDailyPace(
      entries,
      new Date('2026-06-10'),
      new Date('2026-06-10'),
    );
    expect(result).toBe(0);
  });

  it('should calculate average daily spend in pence', () => {
    const entries = [
      makeSpendEntry({ id: 'e1', amount: money(3_000, 'GBP'), spentAt: new Date('2026-06-02') }),
      makeSpendEntry({ id: 'e2', amount: money(7_000, 'GBP'), spentAt: new Date('2026-06-05') }),
    ];
    // 10,000 pence over 10 days = 1,000 pence/day
    const result = calculateDailyPace(
      entries,
      new Date('2026-06-01'),
      new Date('2026-06-11'),
    );
    expect(result).toBe(1_000);
  });
});

// ─── calculateTargetPace ────────────────────────────────────────────────────

describe('calculateTargetPace', () => {
  it('should return budget divided by total days', () => {
    // 100,000 pence over 10 days = 10,000 pence/day
    const result = calculateTargetPace(
      100_000,
      new Date('2026-06-01'),
      new Date('2026-06-11'),
    );
    expect(result).toBe(10_000);
  });

  it('should return 0 when end is before start', () => {
    const result = calculateTargetPace(
      100_000,
      new Date('2026-06-11'),
      new Date('2026-06-01'),
    );
    expect(result).toBe(0);
  });

  it('should return 0 when start equals end', () => {
    const result = calculateTargetPace(
      100_000,
      new Date('2026-06-01'),
      new Date('2026-06-01'),
    );
    expect(result).toBe(0);
  });
});

// ─── calculateBurndownProjection ────────────────────────────────────────────

describe('calculateBurndownProjection', () => {
  const start = new Date('2026-06-01');
  const end = new Date('2026-06-11'); // 10 days
  const budget = 100_000; // £1,000

  it('should return empty projection when date range is invalid', () => {
    const result = calculateBurndownProjection([], budget, end, start, start);
    expect(result.idealLine).toHaveLength(0);
    expect(result.actualLine).toHaveLength(0);
    expect(result.projectedLine).toHaveLength(0);
    expect(result.paceRatio).toBe(0);
  });

  it('should build ideal line as linear drawdown', () => {
    const result = calculateBurndownProjection([], budget, start, end, end);
    // 10 days = 11 data points (day 0 through day 10)
    expect(result.idealLine).toHaveLength(11);
    expect(result.idealLine[0].amountPence).toBe(budget);
    expect(result.idealLine[result.idealLine.length - 1].amountPence).toBe(0);
  });

  it('should build actual line showing remaining budget after spend', () => {
    const entries = [
      makeSpendEntry({ id: 'e1', amount: money(20_000, 'GBP'), spentAt: new Date('2026-06-03') }),
      makeSpendEntry({ id: 'e2', amount: money(10_000, 'GBP'), spentAt: new Date('2026-06-05') }),
    ];
    const current = new Date('2026-06-06');
    const result = calculateBurndownProjection(entries, budget, start, end, current);

    // Day 0 (June 1): no spend → 100,000
    expect(result.actualLine[0].amountPence).toBe(100_000);
    // Day 2 (June 3): 20,000 spent → 80,000
    expect(result.actualLine[2].amountPence).toBe(80_000);
    // Day 4 (June 5): 10,000 more → 70,000
    expect(result.actualLine[4].amountPence).toBe(70_000);
    // Day 5 (June 6): no additional → 70,000
    expect(result.actualLine[5].amountPence).toBe(70_000);
  });

  it('should calculate pace ratio correctly for on-pace spending', () => {
    // Target: 10,000/day. Spend 50,000 in 5 days = 10,000/day → ratio ≈ 1.0
    const entries = [
      makeSpendEntry({ id: 'e1', amount: money(50_000, 'GBP'), spentAt: new Date('2026-06-03') }),
    ];
    const current = new Date('2026-06-06'); // 5 days elapsed
    const result = calculateBurndownProjection(entries, budget, start, end, current);
    expect(result.paceRatio).toBe(1);
  });

  it('should calculate pace ratio correctly for over-pace spending', () => {
    // Target: 10,000/day. Spend 75,000 in 5 days = 15,000/day → ratio = 1.5
    const entries = [
      makeSpendEntry({ id: 'e1', amount: money(75_000, 'GBP'), spentAt: new Date('2026-06-03') }),
    ];
    const current = new Date('2026-06-06');
    const result = calculateBurndownProjection(entries, budget, start, end, current);
    expect(result.paceRatio).toBe(1.5);
  });

  it('should set projected exhaustion date when over budget pace', () => {
    // Budget: 100k, 5 days in, spent 75k. Remaining 25k at 15k/day → 2 more days
    const entries = [
      makeSpendEntry({ id: 'e1', amount: money(75_000, 'GBP'), spentAt: new Date('2026-06-03') }),
    ];
    const current = new Date('2026-06-06');
    const result = calculateBurndownProjection(entries, budget, start, end, current);
    expect(result.projectedExhaustionDate).not.toBeNull();
    // Exhaustion: current (June 6) + ceil(25000/15000) = +2 days → June 8
    expect(result.projectedExhaustionDate!.getTime()).toBeLessThan(end.getTime());
  });

  it('should not set projected exhaustion date when under budget', () => {
    // Budget: 100k, 5 days in, spent 30k. Remaining 70k at 6k/day → ~12 days (past end)
    const entries = [
      makeSpendEntry({ id: 'e1', amount: money(30_000, 'GBP'), spentAt: new Date('2026-06-03') }),
    ];
    const current = new Date('2026-06-06');
    const result = calculateBurndownProjection(entries, budget, start, end, current);
    expect(result.projectedExhaustionDate).toBeNull();
  });

  it('should build projected line from current point forward', () => {
    const entries = [
      makeSpendEntry({ id: 'e1', amount: money(50_000, 'GBP'), spentAt: new Date('2026-06-03') }),
    ];
    const current = new Date('2026-06-06');
    const result = calculateBurndownProjection(entries, budget, start, end, current);
    expect(result.projectedLine.length).toBeGreaterThan(0);
    // First projected point should match last actual point
    expect(result.projectedLine[0].amountPence).toBe(
      result.actualLine[result.actualLine.length - 1].amountPence,
    );
  });

  it('should handle currentDate after endDate', () => {
    const entries = [
      makeSpendEntry({ id: 'e1', amount: money(50_000, 'GBP'), spentAt: new Date('2026-06-05') }),
    ];
    const current = new Date('2026-06-15'); // after end date
    const result = calculateBurndownProjection(entries, budget, start, end, current);
    // Actual line should only go up to end date
    expect(result.actualLine.length).toBeLessThanOrEqual(11);
    // No projected line when past end date
    expect(result.projectedLine).toHaveLength(0);
  });

  it('should handle currentDate before startDate', () => {
    const current = new Date('2026-05-25'); // before start
    const result = calculateBurndownProjection([], budget, start, end, current);
    expect(result.dailyPacePence).toBe(0);
    expect(result.paceRatio).toBe(0);
  });
});

// ─── detectAlerts ───────────────────────────────────────────────────────────

describe('detectAlerts', () => {
  const start = new Date('2026-06-01');
  const end = new Date('2026-06-11');
  const budget = 100_000;

  it('should return no alerts when spending is on pace', () => {
    // Spread spend evenly: 10k/day for 5 days = 50k total. Target: 10k/day. Ratio = 1.0
    const entries = [
      makeSpendEntry({ id: 'e1', amount: money(10_000, 'GBP'), spentAt: new Date('2026-06-02') }),
      makeSpendEntry({ id: 'e2', amount: money(10_000, 'GBP'), spentAt: new Date('2026-06-03') }),
      makeSpendEntry({ id: 'e3', amount: money(10_000, 'GBP'), spentAt: new Date('2026-06-04') }),
      makeSpendEntry({ id: 'e4', amount: money(10_000, 'GBP'), spentAt: new Date('2026-06-05') }),
      makeSpendEntry({ id: 'e5', amount: money(10_000, 'GBP'), spentAt: new Date('2026-06-06') }),
    ];
    const current = new Date('2026-06-06');
    const projection = calculateBurndownProjection(entries, budget, start, end, current);
    const alerts = detectAlerts(projection, entries, end);
    expect(alerts).toHaveLength(0);
  });

  it('should detect over-pace spending', () => {
    const entries = [
      makeSpendEntry({ id: 'e1', amount: money(75_000, 'GBP'), spentAt: new Date('2026-06-03') }),
    ];
    const current = new Date('2026-06-06');
    const projection = calculateBurndownProjection(entries, budget, start, end, current);
    const alerts = detectAlerts(projection, entries, end);
    const overPace = alerts.find((a) => a.type === 'over-pace');
    expect(overPace).toBeDefined();
    expect(overPace!.severity).toBe('warning');
    expect(overPace!.message).toContain('50%');
  });

  it('should detect projected exhaustion', () => {
    const entries = [
      makeSpendEntry({ id: 'e1', amount: money(75_000, 'GBP'), spentAt: new Date('2026-06-03') }),
    ];
    const current = new Date('2026-06-06');
    const projection = calculateBurndownProjection(entries, budget, start, end, current);
    const alerts = detectAlerts(projection, entries, end);
    const exhaustion = alerts.find((a) => a.type === 'projected-exhaustion');
    expect(exhaustion).toBeDefined();
    expect(exhaustion!.severity).toBe('danger');
  });

  it('should detect single-day spike', () => {
    // Target pace: 10,000/day. Spike threshold: 20,000/day.
    const entries = [
      makeSpendEntry({ id: 'e1', amount: money(25_000, 'GBP'), spentAt: new Date('2026-06-03') }),
    ];
    const current = new Date('2026-06-06');
    const projection = calculateBurndownProjection(entries, budget, start, end, current);
    const alerts = detectAlerts(projection, entries, end);
    const spike = alerts.find((a) => a.type === 'single-day-spike');
    expect(spike).toBeDefined();
    expect(spike!.severity).toBe('warning');
  });

  it('should not detect spike when daily total is below threshold', () => {
    // Target pace: 10,000/day. Two entries same day totalling 15,000 < 20,000 threshold
    const entries = [
      makeSpendEntry({ id: 'e1', amount: money(8_000, 'GBP'), spentAt: new Date('2026-06-03') }),
      makeSpendEntry({ id: 'e2', amount: money(7_000, 'GBP'), spentAt: new Date('2026-06-03') }),
    ];
    const current = new Date('2026-06-06');
    const projection = calculateBurndownProjection(entries, budget, start, end, current);
    const alerts = detectAlerts(projection, entries, end);
    const spike = alerts.find((a) => a.type === 'single-day-spike');
    expect(spike).toBeUndefined();
  });
});

// ─── calculateTripBurndown ──────────────────────────────────────────────────

describe('calculateTripBurndown', () => {
  it('should return null when no destinations have dates', () => {
    const trip = makeTrip();
    const destinations = [
      makeDestination({ startDate: null, endDate: null }),
    ];
    const result = calculateTripBurndown(trip, destinations, [], new Date());
    expect(result).toBeNull();
  });

  it('should aggregate across multiple dated destinations', () => {
    const trip = makeTrip();
    const destinations = [
      makeDestination({
        id: 'dest-1',
        estimatedBudget: money(60_000, 'GBP'),
        startDate: new Date('2026-06-01'),
        endDate: new Date('2026-06-15'),
      }),
      makeDestination({
        id: 'dest-2',
        estimatedBudget: money(40_000, 'GBP'),
        startDate: new Date('2026-06-15'),
        endDate: new Date('2026-07-01'),
      }),
    ];
    const spend = [
      makeSpendEntry({ id: 'e1', destinationId: 'dest-1', amount: money(10_000, 'GBP'), spentAt: new Date('2026-06-05') }),
      makeSpendEntry({ id: 'e2', destinationId: 'dest-2', amount: money(5_000, 'GBP'), spentAt: new Date('2026-06-20') }),
    ];
    const current = new Date('2026-06-20');
    const result = calculateTripBurndown(trip, destinations, spend, current);

    expect(result).not.toBeNull();
    // Total budget: 60k + 40k = 100k
    expect(result!.idealLine[0].amountPence).toBe(100_000);
    // Date range: June 1 to July 1
    const expectedStart = new Date('2026-06-01');
    expectedStart.setHours(0, 0, 0, 0);
    expect(result!.idealLine[0].date).toEqual(expectedStart);
  });

  it('should exclude spend from undated destinations', () => {
    const trip = makeTrip();
    const destinations = [
      makeDestination({
        id: 'dest-1',
        estimatedBudget: money(50_000, 'GBP'),
        startDate: new Date('2026-06-01'),
        endDate: new Date('2026-06-11'),
      }),
      makeDestination({
        id: 'dest-undated',
        estimatedBudget: money(30_000, 'GBP'),
        startDate: null,
        endDate: null,
      }),
    ];
    const spend = [
      makeSpendEntry({ id: 'e1', destinationId: 'dest-1', amount: money(10_000, 'GBP'), spentAt: new Date('2026-06-05') }),
      makeSpendEntry({ id: 'e2', destinationId: 'dest-undated', amount: money(20_000, 'GBP'), spentAt: new Date('2026-06-05') }),
    ];
    const current = new Date('2026-06-06');
    const result = calculateTripBurndown(trip, destinations, spend, current);

    expect(result).not.toBeNull();
    // Only dest-1 budget: 50k
    expect(result!.idealLine[0].amountPence).toBe(50_000);
    // Only dest-1 spend counted: 10k. Remaining: 40k
    expect(result!.actualLine[result!.actualLine.length - 1].amountPence).toBe(40_000);
  });
});
