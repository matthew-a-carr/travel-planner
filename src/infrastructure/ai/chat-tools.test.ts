import { describe, expect, it, vi } from 'vitest';
import type { DestinationRepository } from '@/domain/destination/destination-repository';
import type { SpendEntryRepository } from '@/domain/spending/spend-entry-repository';
import type { TripFixedCostRepository } from '@/domain/trip/fixed-cost-repository';
import type { TripRepository } from '@/domain/trip/trip-repository';
import {
  type Destination,
  moneyUnchecked,
  type SpendEntry,
  type Trip,
  type TripFixedCost,
} from '@/domain/trip/types';
import { type ChatToolDeps, createChatTools } from './chat-tools';

function makeTrip(overrides: Partial<Trip> = {}): Trip {
  return {
    id: 'trip-1',
    organizationId: 'org-1',
    ownerId: 'user-1',
    name: 'Asia 2026',
    totalBudget: moneyUnchecked(500_000, 'GBP'),
    status: 'active',
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

function makeDestination(overrides: Partial<Destination> = {}): Destination {
  return {
    id: 'dest-1',
    tripId: 'trip-1',
    name: 'Hanoi',
    country: 'Vietnam',
    city: 'Hanoi',
    latitude: null,
    longitude: null,
    estimatedBudget: moneyUnchecked(100_000, 'GBP'),
    comfortLevel: 'mid',
    startDate: new Date('2026-04-01'),
    endDate: new Date('2026-04-08'),
    sortOrder: 0,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

function makeSpend(overrides: Partial<SpendEntry> = {}): SpendEntry {
  return {
    id: 'spend-1',
    destinationId: 'dest-1',
    amount: moneyUnchecked(800, 'GBP'),
    category: 'food',
    description: null,
    spentAt: new Date('2026-04-02'),
    createdAt: new Date('2026-04-02'),
    ...overrides,
  };
}

function makeFixedCost(overrides: Partial<TripFixedCost> = {}): TripFixedCost {
  return {
    id: 'fc-1',
    tripId: 'trip-1',
    label: 'Flights',
    amount: moneyUnchecked(80_000, 'GBP'),
    category: 'transport',
    date: new Date('2026-04-01'),
    sortOrder: 0,
    createdAt: new Date('2026-01-01'),
    ...overrides,
  };
}

function makeDeps(overrides: {
  trip?: Trip | null;
  destinations?: readonly Destination[];
  spend?: readonly SpendEntry[];
  fixedCosts?: readonly TripFixedCost[];
} = {}): ChatToolDeps {
  const trip = 'trip' in overrides ? overrides.trip : makeTrip();
  return {
    tripRepository: {
      findById: vi.fn().mockResolvedValue(trip),
      findAllByOrganization: vi.fn(),
      save: vi.fn(),
      delete: vi.fn(),
    } as TripRepository,
    destinationRepository: {
      findById: vi.fn(),
      findByTrip: vi.fn().mockResolvedValue(overrides.destinations ?? [makeDestination()]),
      save: vi.fn(),
      delete: vi.fn(),
    } as DestinationRepository,
    spendEntryRepository: {
      findById: vi.fn(),
      findByDestination: vi.fn(),
      findByTrip: vi.fn().mockResolvedValue(overrides.spend ?? []),
      save: vi.fn(),
      delete: vi.fn(),
    } as SpendEntryRepository,
    tripFixedCostRepository: {
      findById: vi.fn(),
      findByTrip: vi.fn().mockResolvedValue(overrides.fixedCosts ?? []),
      save: vi.fn(),
      delete: vi.fn(),
    } as TripFixedCostRepository,
  };
}

describe('createChatTools', () => {
  describe('get_trip_summary', () => {
    it('returns budget summary fields and dated date range', async () => {
      const tools = createChatTools(
        makeDeps({
          destinations: [
            makeDestination({ id: 'd1', startDate: new Date('2026-04-01'), endDate: new Date('2026-04-10') }),
            makeDestination({ id: 'd2', startDate: new Date('2026-04-15'), endDate: new Date('2026-04-25') }),
          ],
          fixedCosts: [makeFixedCost({ amount: moneyUnchecked(80_000, 'GBP') })],
        }),
        'trip-1',
      );

      const result = (await tools.get_trip_summary.execute?.(
        {},
        { toolCallId: 'c1', messages: [] },
      )) as Record<string, unknown>;

      expect(result.name).toBe('Asia 2026');
      expect(result.destinationCount).toBe(2);
      expect(result.datedDestinationCount).toBe(2);
      expect(result.fixedCostsCount).toBe(1);
      expect(result.totalBudgetPence).toBe(500_000);
      expect(result.totalFixedPence).toBe(80_000);
      expect(result.allocatedPence).toBe(200_000);
      expect(result.availablePence).toBe(220_000);
      expect(result.earliestStartDate).toBe('2026-04-01');
      expect(result.latestEndDate).toBe('2026-04-25');
    });

    it('returns an error when the trip is missing', async () => {
      const tools = createChatTools(makeDeps({ trip: null }), 'missing');
      const result = (await tools.get_trip_summary.execute?.(
        {},
        { toolCallId: 'c1', messages: [] },
      )) as Record<string, unknown>;
      expect(result.error).toMatch(/Trip not found/);
    });
  });

  describe('list_destinations', () => {
    it('returns destinations in sort order with iso dates and computed days', async () => {
      const tools = createChatTools(
        makeDeps({
          destinations: [
            makeDestination({
              id: 'd1',
              sortOrder: 1,
              startDate: new Date('2026-04-08'),
              endDate: new Date('2026-04-15'),
            }),
            makeDestination({
              id: 'd2',
              sortOrder: 0,
              startDate: new Date('2026-04-01'),
              endDate: new Date('2026-04-08'),
            }),
            makeDestination({ id: 'd3', sortOrder: 2, startDate: null, endDate: null }),
          ],
        }),
        'trip-1',
      );

      const result = (await tools.list_destinations.execute?.(
        {},
        { toolCallId: 'c1', messages: [] },
      )) as { destinations: { id: string; days: number | null; startDate: string | null }[] };

      expect(result.destinations.map((d) => d.id)).toEqual(['d2', 'd1', 'd3']);
      expect(result.destinations[0].days).toBe(7);
      expect(result.destinations[0].startDate).toBe('2026-04-01');
      expect(result.destinations[2].days).toBe(null);
    });
  });

  describe('get_burndown', () => {
    it('returns null projection when no destinations are dated', async () => {
      const tools = createChatTools(
        makeDeps({
          destinations: [makeDestination({ startDate: null, endDate: null })],
          spend: [],
        }),
        'trip-1',
        () => new Date('2026-04-05'),
      );

      const result = (await tools.get_burndown.execute?.(
        {},
        { toolCallId: 'c1', messages: [] },
      )) as { projection: unknown; alerts: unknown[]; totalSpentPence: number };

      expect(result.projection).toBe(null);
      expect(result.alerts).toEqual([]);
      expect(result.totalSpentPence).toBe(0);
    });

    it('reports daily pace and alerts when spending is over target', async () => {
      const dest = makeDestination({
        id: 'd1',
        startDate: new Date('2026-04-01'),
        endDate: new Date('2026-04-11'),
        estimatedBudget: moneyUnchecked(10_000, 'GBP'),
      });
      const spend = [
        makeSpend({ id: 's1', destinationId: 'd1', amount: moneyUnchecked(3_000, 'GBP'), spentAt: new Date('2026-04-02') }),
        makeSpend({ id: 's2', destinationId: 'd1', amount: moneyUnchecked(3_000, 'GBP'), spentAt: new Date('2026-04-03') }),
      ];
      const tools = createChatTools(
        makeDeps({ destinations: [dest], spend }),
        'trip-1',
        () => new Date('2026-04-04'),
      );

      const result = (await tools.get_burndown.execute?.(
        {},
        { toolCallId: 'c1', messages: [] },
      )) as {
        projection: { dailyPacePence: number; targetPacePence: number; paceRatio: number };
        alerts: { type: string }[];
        totalSpentPence: number;
      };

      expect(result.totalSpentPence).toBe(6_000);
      expect(result.projection.dailyPacePence).toBeGreaterThan(0);
      expect(result.projection.targetPacePence).toBe(1_000);
      expect(result.alerts.some((a) => a.type === 'over-pace')).toBe(true);
    });
  });

  describe('get_spending_by_category', () => {
    it('aggregates spend totals per category', async () => {
      const tools = createChatTools(
        makeDeps({
          spend: [
            makeSpend({ id: 's1', amount: moneyUnchecked(800, 'GBP'), category: 'food' }),
            makeSpend({ id: 's2', amount: moneyUnchecked(300, 'GBP'), category: 'food' }),
            makeSpend({ id: 's3', amount: moneyUnchecked(2_500, 'GBP'), category: 'accommodation' }),
          ],
        }),
        'trip-1',
      );

      const result = (await tools.get_spending_by_category.execute?.(
        {},
        { toolCallId: 'c1', messages: [] },
      )) as { byCategoryPence: Record<string, number>; totalPence: number; entryCount: number };

      expect(result.byCategoryPence).toEqual({
        food: 1_100,
        accommodation: 2_500,
      });
      expect(result.totalPence).toBe(3_600);
      expect(result.entryCount).toBe(3);
    });

    it('returns empty totals when there is no spend yet', async () => {
      const tools = createChatTools(makeDeps({ spend: [] }), 'trip-1');
      const result = (await tools.get_spending_by_category.execute?.(
        {},
        { toolCallId: 'c1', messages: [] },
      )) as { byCategoryPence: Record<string, number>; totalPence: number };
      expect(result.byCategoryPence).toEqual({});
      expect(result.totalPence).toBe(0);
    });
  });

  it('binds tripId at construction time — repos see the bound id', async () => {
    const deps = makeDeps();
    const tools = createChatTools(deps, 'trip-bound');

    await tools.get_trip_summary.execute?.({}, { toolCallId: 'c1', messages: [] });

    expect(deps.tripRepository.findById).toHaveBeenCalledWith('trip-bound');
    expect(deps.destinationRepository.findByTrip).toHaveBeenCalledWith('trip-bound');
    expect(deps.tripFixedCostRepository.findByTrip).toHaveBeenCalledWith('trip-bound');
  });
});
