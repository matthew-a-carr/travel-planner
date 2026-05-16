import { describe, expect, it } from 'vitest';
import type { Destination, SpendEntry, TripFixedCost, TripStatus } from '@/domain/trip/types';
import { getTripStage, hasTwoOrMoreDatedDestinations } from './trip-stage';

function destination(overrides: Partial<Destination> = {}): Destination {
  return {
    id: 'd1',
    tripId: 't1',
    name: 'Japan',
    country: 'Japan',
    city: null,
    latitude: null,
    longitude: null,
    estimatedBudget: { amountPence: 100_000, currency: 'GBP' },
    comfortLevel: 'mid',
    startDate: null,
    endDate: null,
    sortOrder: 0,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

function fixedCost(overrides: Partial<TripFixedCost> = {}): TripFixedCost {
  return {
    id: 'f1',
    tripId: 't1',
    label: 'Flights',
    amount: { amountPence: 50_000, currency: 'GBP' },
    category: 'transport',
    date: new Date('2026-01-01'),
    sortOrder: 0,
    createdAt: new Date('2026-01-01'),
    ...overrides,
  };
}

function spend(overrides: Partial<SpendEntry> = {}): SpendEntry {
  return {
    id: 's1',
    destinationId: 'd1',
    amount: { amountPence: 1_000, currency: 'GBP' },
    category: 'food',
    description: null,
    spentAt: new Date('2026-01-01'),
    createdAt: new Date('2026-01-01'),
    ...overrides,
  };
}

describe('getTripStage', () => {
  it('returns "empty" when there are no destinations, fixed costs, or spend, and status is planning', () => {
    expect(getTripStage({ status: 'planning' as TripStatus }, [], [], [])).toBe('empty');
  });

  it('returns "planning" when destinations exist but no spend and status is planning', () => {
    expect(getTripStage({ status: 'planning' as TripStatus }, [destination()], [], [])).toBe(
      'planning',
    );
  });

  it('returns "planning" when only fixed costs exist', () => {
    expect(getTripStage({ status: 'planning' as TripStatus }, [], [fixedCost()], [])).toBe(
      'planning',
    );
  });

  it('returns "active" when any spend has been recorded', () => {
    expect(
      getTripStage({ status: 'planning' as TripStatus }, [destination()], [], [spend()]),
    ).toBe('active');
  });

  it('returns "active" when status is active even without spend', () => {
    expect(getTripStage({ status: 'active' as TripStatus }, [destination()], [], [])).toBe(
      'active',
    );
  });

  it('returns "completed" when status is completed (overrides everything else)', () => {
    expect(
      getTripStage(
        { status: 'completed' as TripStatus },
        [destination()],
        [fixedCost()],
        [spend()],
      ),
    ).toBe('completed');
  });
});

describe('hasTwoOrMoreDatedDestinations', () => {
  it('returns false when no destinations have date ranges', () => {
    expect(hasTwoOrMoreDatedDestinations([destination(), destination({ id: 'd2' })])).toBe(false);
  });

  it('returns false with only one dated destination', () => {
    expect(
      hasTwoOrMoreDatedDestinations([
        destination({ startDate: new Date('2026-02-01'), endDate: new Date('2026-02-08') }),
        destination({ id: 'd2' }),
      ]),
    ).toBe(false);
  });

  it('returns true when two or more destinations have date ranges', () => {
    expect(
      hasTwoOrMoreDatedDestinations([
        destination({
          id: 'd1',
          startDate: new Date('2026-02-01'),
          endDate: new Date('2026-02-08'),
        }),
        destination({
          id: 'd2',
          startDate: new Date('2026-02-09'),
          endDate: new Date('2026-02-15'),
        }),
      ]),
    ).toBe(true);
  });
});
