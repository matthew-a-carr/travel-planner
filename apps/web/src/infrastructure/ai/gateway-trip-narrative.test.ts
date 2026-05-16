import { generateObject } from 'ai';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Destination, SpendEntry, Trip, TripFixedCost } from '@/domain/trip/types';
import { moneyUnchecked } from '@/domain/trip/types';
import { GatewayTripNarrativeService } from './gateway-trip-narrative';

vi.mock('ai', () => ({
  generateObject: vi.fn(),
}));

const mockedGenerateObject = vi.mocked(generateObject);

const FAKE_MODEL_ID = 'google/gemini-3-flash';

function makeTrip(overrides: Partial<Trip> = {}): Trip {
  return {
    id: 'trip-1',
    organizationId: 'org-1',
    ownerId: 'user-1',
    name: 'Asia 2026',
    totalBudget: moneyUnchecked(5_000_000, 'GBP'),
    status: 'active',
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

function makeDestination(overrides: Partial<Destination> & { id: string }): Destination {
  return {
    tripId: 'trip-1',
    name: 'Hanoi',
    country: 'Vietnam',
    city: 'Hanoi',
    latitude: null,
    longitude: null,
    estimatedBudget: moneyUnchecked(500_000, 'GBP'),
    comfortLevel: 'mid',
    startDate: new Date('2026-07-25'),
    endDate: new Date('2026-08-05'),
    sortOrder: 0,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

function makeSpend(overrides: Partial<SpendEntry> & { id: string }): SpendEntry {
  return {
    destinationId: 'd1',
    amount: moneyUnchecked(2_000, 'GBP'),
    category: 'food',
    description: null,
    spentAt: new Date('2026-07-30'),
    createdAt: new Date('2026-07-30'),
    ...overrides,
  };
}

const flights: TripFixedCost = {
  id: 'fc-1',
  tripId: 'trip-1',
  label: 'Flights',
  amount: moneyUnchecked(120_000, 'GBP'),
  category: 'transport',
  date: new Date('2026-07-24'),
  sortOrder: 0,
  createdAt: new Date('2026-01-01'),
};

beforeEach(() => {
  mockedGenerateObject.mockReset();
});

describe('GatewayTripNarrativeService', () => {
  it('returns the model output verbatim on success', async () => {
    mockedGenerateObject.mockResolvedValueOnce({
      object: {
        narrative:
          "You're tracking £4/day above pace in Hanoi, leaving £40 less wiggle room by the end of August.",
        bullets: ['Skip one £15 meal this week', 'Hold off on adding more shopping spend'],
      },
    } as Awaited<ReturnType<typeof generateObject>>);

    const service = new GatewayTripNarrativeService(FAKE_MODEL_ID);
    const outcome = await service.summarise({
      trip: makeTrip(),
      destinations: [makeDestination({ id: 'd1' })],
      fixedCosts: [flights],
      spendEntries: [makeSpend({ id: 's1' })],
      currentDate: new Date('2026-08-01'),
    });

    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.result.narrative).toContain('above pace');
      expect(outcome.result.bullets).toHaveLength(2);
    }
  });

  it('forwards the model id and a JSON snapshot to generateObject', async () => {
    mockedGenerateObject.mockResolvedValueOnce({
      object: { narrative: 'On pace.', bullets: [] },
    } as Awaited<ReturnType<typeof generateObject>>);

    const service = new GatewayTripNarrativeService(FAKE_MODEL_ID);
    await service.summarise({
      trip: makeTrip(),
      destinations: [makeDestination({ id: 'd1' })],
      fixedCosts: [flights],
      spendEntries: [],
      currentDate: new Date('2026-08-01'),
    });

    expect(mockedGenerateObject).toHaveBeenCalledTimes(1);
    const call = mockedGenerateObject.mock.calls[0]?.[0];
    expect(call?.model).toBe(FAKE_MODEL_ID);
    expect(call?.prompt).toContain('"tripName": "Asia 2026"');
    expect(call?.prompt).toContain('"currentDate": "2026-08-01"');
  });

  it('returns a typed error when generateObject throws', async () => {
    mockedGenerateObject.mockRejectedValueOnce(new Error('gateway 503'));

    const service = new GatewayTripNarrativeService(FAKE_MODEL_ID);
    const outcome = await service.summarise({
      trip: makeTrip(),
      destinations: [],
      fixedCosts: [],
      spendEntries: [],
      currentDate: new Date('2026-08-01'),
    });

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.error).toContain('Trip narrative failed');
      expect(outcome.error).toContain('gateway 503');
    }
  });

  it('returns a typed error when generateObject throws a non-Error value', async () => {
    mockedGenerateObject.mockRejectedValueOnce('quota exceeded');

    const service = new GatewayTripNarrativeService(FAKE_MODEL_ID);
    const outcome = await service.summarise({
      trip: makeTrip(),
      destinations: [],
      fixedCosts: [],
      spendEntries: [],
      currentDate: new Date('2026-08-01'),
    });

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.error).toContain('Unknown narrative error');
  });
});
