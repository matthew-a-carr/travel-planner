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
      findByTrips: vi.fn().mockResolvedValue(overrides.destinations ?? [makeDestination()]),
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

  describe('record_spend', () => {
    function setup(overrides: Parameters<typeof makeDeps>[0] = {}, tripIdOverride?: string) {
      const dest = makeDestination({
        id: 'd1',
        startDate: new Date('2026-04-01'),
        endDate: new Date('2026-04-11'),
        estimatedBudget: moneyUnchecked(10_000, 'GBP'),
      });
      const deps = makeDeps({ destinations: [dest], spend: [], ...overrides });
      (deps.destinationRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValue(dest);
      (deps.spendEntryRepository.save as ReturnType<typeof vi.fn>).mockImplementation(
        async (e: SpendEntry) => e,
      );
      const tools = createChatTools(deps, tripIdOverride ?? 'trip-1', () => new Date('2026-04-04'));
      return { deps, tools, dest };
    }

    it('auto-executes a small spend within pace', async () => {
      const { deps, tools } = setup();
      const result = (await tools.record_spend.execute?.(
        {
          destinationId: 'd1',
          amountPence: 500,
          category: 'food',
        },
        { toolCallId: 'c1', messages: [] },
      )) as { ok?: boolean; requiresConfirmation?: boolean; summary?: string };

      expect(result.ok).toBe(true);
      expect(result.summary).toMatch(/Recorded £5\.00/);
      expect(deps.spendEntryRepository.save).toHaveBeenCalled();
    });

    it('returns requiresConfirmation when the spend exceeds destination headroom', async () => {
      const dest = makeDestination({
        id: 'd1',
        startDate: new Date('2026-04-01'),
        endDate: new Date('2026-04-11'),
        estimatedBudget: moneyUnchecked(1_000, 'GBP'),
      });
      const deps = makeDeps({ destinations: [dest], spend: [] });
      (deps.destinationRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValue(dest);
      const tools = createChatTools(deps, 'trip-1', () => new Date('2026-04-04'));

      const result = (await tools.record_spend.execute?.(
        { destinationId: 'd1', amountPence: 5_000, category: 'food' },
        { toolCallId: 'c1', messages: [] },
      )) as { requiresConfirmation?: boolean; summary?: string };

      expect(result.requiresConfirmation).toBe(true);
      expect(result.summary).toMatch(/Heads-up/);
      expect(deps.spendEntryRepository.save).not.toHaveBeenCalled();
    });

    it('executes when confirmed: true is passed even if risky', async () => {
      const dest = makeDestination({
        id: 'd1',
        startDate: new Date('2026-04-01'),
        endDate: new Date('2026-04-11'),
        estimatedBudget: moneyUnchecked(1_000, 'GBP'),
      });
      const deps = makeDeps({ destinations: [dest], spend: [] });
      (deps.destinationRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValue(dest);
      (deps.spendEntryRepository.save as ReturnType<typeof vi.fn>).mockImplementation(
        async (e: SpendEntry) => e,
      );
      const tools = createChatTools(deps, 'trip-1', () => new Date('2026-04-04'));

      const result = (await tools.record_spend.execute?.(
        {
          destinationId: 'd1',
          amountPence: 5_000,
          category: 'food',
          confirmed: true,
        },
        { toolCallId: 'c1', messages: [] },
      )) as { ok?: boolean };

      expect(result.ok).toBe(true);
      expect(deps.spendEntryRepository.save).toHaveBeenCalled();
    });

    it('rejects a destination from a different trip', async () => {
      const otherDest = makeDestination({ id: 'd1', tripId: 'trip-other' });
      const deps = makeDeps();
      (deps.destinationRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValue(otherDest);
      const tools = createChatTools(deps, 'trip-1');

      const result = (await tools.record_spend.execute?.(
        { destinationId: 'd1', amountPence: 100, category: 'food' },
        { toolCallId: 'c1', messages: [] },
      )) as { error?: string };

      expect(result.error).toMatch(/not part of this trip/);
      expect(deps.spendEntryRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('edit_destination', () => {
    it('auto-executes a label-only tweak', async () => {
      const existing = makeDestination({ id: 'd1', name: 'Hanoi' });
      const deps = makeDeps({ destinations: [existing] });
      (deps.destinationRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValue(existing);
      (deps.destinationRepository.save as ReturnType<typeof vi.fn>).mockImplementation(
        async (d: Destination) => d,
      );
      const tools = createChatTools(deps, 'trip-1');

      const result = (await tools.edit_destination.execute?.(
        { destinationId: 'd1', name: 'Hanoi (updated)' },
        { toolCallId: 'c1', messages: [] },
      )) as { ok?: boolean; summary?: string };

      expect(result.ok).toBe(true);
      expect(deps.destinationRepository.save).toHaveBeenCalled();
    });

    it('requires confirmation when start/end date changes', async () => {
      const existing = makeDestination({
        id: 'd1',
        startDate: new Date('2026-04-01'),
        endDate: new Date('2026-04-08'),
      });
      const deps = makeDeps({ destinations: [existing] });
      (deps.destinationRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValue(existing);
      const tools = createChatTools(deps, 'trip-1');

      const result = (await tools.edit_destination.execute?.(
        { destinationId: 'd1', startDate: '2026-04-03', endDate: '2026-04-10' },
        { toolCallId: 'c1', messages: [] },
      )) as { requiresConfirmation?: boolean; summary?: string };

      expect(result.requiresConfirmation).toBe(true);
      expect(result.summary).toMatch(/schedule dates/);
      expect(deps.destinationRepository.save).not.toHaveBeenCalled();
    });

    it('rejects a destination from a different trip', async () => {
      const otherDest = makeDestination({ id: 'd1', tripId: 'trip-other' });
      const deps = makeDeps();
      (deps.destinationRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValue(otherDest);
      const tools = createChatTools(deps, 'trip-1');

      const result = (await tools.edit_destination.execute?.(
        { destinationId: 'd1', name: 'X' },
        { toolCallId: 'c1', messages: [] },
      )) as { error?: string };

      expect(result.error).toMatch(/not part of this trip/);
    });
  });

  describe('add_fixed_cost', () => {
    it('auto-executes when within headroom', async () => {
      const deps = makeDeps({
        destinations: [makeDestination({ estimatedBudget: moneyUnchecked(50_000, 'GBP') })],
        fixedCosts: [],
      });
      (deps.tripFixedCostRepository.save as ReturnType<typeof vi.fn>).mockImplementation(
        async (fc: TripFixedCost) => fc,
      );
      const tools = createChatTools(deps, 'trip-1');

      const result = (await tools.add_fixed_cost.execute?.(
        {
          label: 'Insurance',
          amountPence: 10_000,
          category: 'insurance',
          date: '2026-04-01',
        },
        { toolCallId: 'c1', messages: [] },
      )) as { ok?: boolean; summary?: string };

      expect(result.ok).toBe(true);
      expect(deps.tripFixedCostRepository.save).toHaveBeenCalled();
    });

    it('requires confirmation when exceeding headroom', async () => {
      const deps = makeDeps({
        destinations: [makeDestination({ estimatedBudget: moneyUnchecked(490_000, 'GBP') })],
        fixedCosts: [],
      });
      const tools = createChatTools(deps, 'trip-1');

      const result = (await tools.add_fixed_cost.execute?.(
        {
          label: 'Visas',
          amountPence: 50_000,
          category: 'visas',
          date: '2026-04-01',
        },
        { toolCallId: 'c1', messages: [] },
      )) as { requiresConfirmation?: boolean };

      expect(result.requiresConfirmation).toBe(true);
      expect(deps.tripFixedCostRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('edit_trip_budget', () => {
    it('always requires confirmation on the first call', async () => {
      const deps = makeDeps();
      const tools = createChatTools(deps, 'trip-1');
      const result = (await tools.edit_trip_budget.execute?.(
        { totalBudgetPence: 600_000 },
        { toolCallId: 'c1', messages: [] },
      )) as { requiresConfirmation?: boolean; summary?: string };

      expect(result.requiresConfirmation).toBe(true);
      expect(result.summary).toMatch(/budget.*£5,000\.00.*£6,000\.00/);
      expect(deps.tripRepository.save).not.toHaveBeenCalled();
    });

    it('summary mentions every changed field — budget, name, status', async () => {
      const deps = makeDeps();
      const tools = createChatTools(deps, 'trip-1');
      const result = (await tools.edit_trip_budget.execute?.(
        { totalBudgetPence: 600_000, name: 'Renamed Trip', status: 'completed' },
        { toolCallId: 'c1', messages: [] },
      )) as { requiresConfirmation?: boolean; summary?: string };

      expect(result.requiresConfirmation).toBe(true);
      expect(result.summary).toMatch(/budget/);
      expect(result.summary).toMatch(/name "Asia 2026" → "Renamed Trip"/);
      expect(result.summary).toMatch(/status active → completed/);
    });

    it('summary omits fields that match current values', async () => {
      const deps = makeDeps();
      const tools = createChatTools(deps, 'trip-1');
      const trip = makeTrip();
      const result = (await tools.edit_trip_budget.execute?.(
        { totalBudgetPence: trip.totalBudget.amountPence, name: trip.name, status: trip.status },
        { toolCallId: 'c1', messages: [] },
      )) as { requiresConfirmation?: boolean; summary?: string };

      expect(result.requiresConfirmation).toBe(true);
      expect(result.summary).toMatch(/No changes/);
    });

    it('executes when confirmed: true', async () => {
      const trip = makeTrip();
      const deps = makeDeps({ trip });
      (deps.tripRepository.save as ReturnType<typeof vi.fn>).mockImplementation(
        async (t: Trip) => t,
      );
      const tools = createChatTools(deps, 'trip-1');

      const result = (await tools.edit_trip_budget.execute?.(
        { totalBudgetPence: 600_000, confirmed: true },
        { toolCallId: 'c1', messages: [] },
      )) as { ok?: boolean };

      expect(result.ok).toBe(true);
      expect(deps.tripRepository.save).toHaveBeenCalled();
    });
  });

  describe('delete_spend_entry', () => {
    it('deletes and returns undo metadata', async () => {
      const dest = makeDestination({ id: 'd1' });
      const entry = makeSpend({ id: 's1', destinationId: 'd1' });
      const deps = makeDeps({ destinations: [dest] });
      (deps.spendEntryRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValue(entry);
      (deps.destinationRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValue(dest);
      const tools = createChatTools(deps, 'trip-1');

      const result = (await tools.delete_spend_entry.execute?.(
        { spendEntryId: 's1' },
        { toolCallId: 'c1', messages: [] },
      )) as {
        ok?: boolean;
        undo?: { kind: string; destinationId: string; amountPence: number };
      };

      expect(result.ok).toBe(true);
      expect(deps.spendEntryRepository.delete).toHaveBeenCalledWith('s1');
      expect(result.undo).toEqual(
        expect.objectContaining({
          kind: 'record_spend',
          destinationId: 'd1',
          amountPence: 800,
        }),
      );
    });

    it('rejects a spend entry from a different trip', async () => {
      const otherDest = makeDestination({ id: 'd1', tripId: 'trip-other' });
      const entry = makeSpend({ id: 's1', destinationId: 'd1' });
      const deps = makeDeps();
      (deps.spendEntryRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValue(entry);
      (deps.destinationRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValue(otherDest);
      const tools = createChatTools(deps, 'trip-1');

      const result = (await tools.delete_spend_entry.execute?.(
        { spendEntryId: 's1' },
        { toolCallId: 'c1', messages: [] },
      )) as { error?: string };

      expect(result.error).toMatch(/not part of this trip/);
      expect(deps.spendEntryRepository.delete).not.toHaveBeenCalled();
    });
  });
});
