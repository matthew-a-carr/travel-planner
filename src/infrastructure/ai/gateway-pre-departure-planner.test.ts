import { generateObject } from 'ai';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Destination, Trip, TripFixedCost } from '@/domain/trip/types';
import { moneyUnchecked } from '@/domain/trip/types';
import { GatewayPreDeparturePlannerService } from './gateway-pre-departure-planner';

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
    name: 'RTW 2026',
    totalBudget: moneyUnchecked(2_500_000_0, 'GBP'),
    status: 'planning',
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

function makeDestination(overrides: Partial<Destination> & { id: string }): Destination {
  return {
    tripId: 'trip-1',
    name: overrides.id,
    country: 'Vietnam',
    city: null,
    latitude: null,
    longitude: null,
    estimatedBudget: moneyUnchecked(500_000, 'GBP'),
    comfortLevel: 'mid',
    startDate: new Date('2026-08-01'),
    endDate: new Date('2026-08-21'),
    sortOrder: 0,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

beforeEach(() => {
  mockedGenerateObject.mockReset();
});

describe('GatewayPreDeparturePlannerService', () => {
  it('short-circuits without calling the model when there are no destinations', async () => {
    const service = new GatewayPreDeparturePlannerService(FAKE_MODEL_ID);
    const outcome = await service.plan({
      trip: makeTrip(),
      destinations: [],
      fixedCosts: [],
      currentDate: new Date('2026-05-15'),
    });

    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.result.items).toEqual([]);
      expect(outcome.result.transportLegs).toEqual([]);
    }
    expect(mockedGenerateObject).not.toHaveBeenCalled();
  });

  it('parses generateObject output into typed checklist items and transport legs', async () => {
    mockedGenerateObject.mockResolvedValueOnce({
      object: {
        items: [
          {
            title: 'Apply for Australia Working Holiday Visa (Subclass 417)',
            category: 'visa',
            dueDate: '2026-09-15',
            costPence: 45_500,
            suggestion: 'Apply online and verify with the embassy that the subclass applies.',
            verifyAt: 'embassy',
          },
          {
            title: 'Hep A/B vaccination course',
            category: 'vaccination',
            dueDate: '2026-07-01',
            costPence: 12_000,
            suggestion: 'Start course early — verify with a travel-health clinic.',
            verifyAt: 'doctor',
          },
        ],
        transportLegs: [
          {
            fromDestinationId: 'd1',
            toDestinationId: 'd2',
            mode: 'flight',
            typicalCostPence: 65_000,
            bookingLeadDays: 60,
            notes: 'Typical Bangkok–Sydney one-way mid-range fare.',
          },
        ],
      },
    } as Awaited<ReturnType<typeof generateObject>>);

    const service = new GatewayPreDeparturePlannerService(FAKE_MODEL_ID);
    const outcome = await service.plan({
      trip: makeTrip(),
      destinations: [
        makeDestination({ id: 'd1', country: 'Thailand', name: 'Bangkok' }),
        makeDestination({
          id: 'd2',
          country: 'Australia',
          name: 'Sydney',
          startDate: new Date('2026-09-15'),
          endDate: new Date('2027-09-15'),
        }),
      ],
      fixedCosts: [],
      currentDate: new Date('2026-05-15'),
    });

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.result.items).toHaveLength(2);
    expect(outcome.result.items[0].category).toBe('visa');
    expect(outcome.result.items[0].dueDate?.toISOString().slice(0, 10)).toBe('2026-09-15');
    expect(outcome.result.items[0].verifyAt).toBe('embassy');
    expect(outcome.result.transportLegs).toHaveLength(1);
    expect(outcome.result.transportLegs[0].mode).toBe('flight');
    expect(outcome.result.transportLegs[0].typicalCostPence).toBe(65_000);
  });

  it('forwards a system prompt requiring conservatism and verify-at-source phrasing', async () => {
    mockedGenerateObject.mockResolvedValueOnce({
      object: { items: [], transportLegs: [] },
    } as Awaited<ReturnType<typeof generateObject>>);

    const service = new GatewayPreDeparturePlannerService(FAKE_MODEL_ID);
    await service.plan({
      trip: makeTrip(),
      destinations: [makeDestination({ id: 'd1' })],
      fixedCosts: [],
      currentDate: new Date('2026-05-15'),
    });

    const call = mockedGenerateObject.mock.calls[0]?.[0];
    const system = call?.system ?? '';
    expect(system).toContain("verify with the embassy");
    expect(system).toContain("verify with a travel-health clinic");
    expect(system).toContain("verify with the insurer");
    expect(system).toContain('Be conservative');
  });

  it('returns a typed error when generateObject throws', async () => {
    mockedGenerateObject.mockRejectedValueOnce(new Error('gateway 503'));

    const service = new GatewayPreDeparturePlannerService(FAKE_MODEL_ID);
    const outcome = await service.plan({
      trip: makeTrip(),
      destinations: [makeDestination({ id: 'd1' })],
      fixedCosts: [],
      currentDate: new Date('2026-05-15'),
    });

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.error).toContain('Pre-departure planner failed');
      expect(outcome.error).toContain('gateway 503');
    }
  });

  it('returns a typed error when generateObject throws a non-Error value', async () => {
    mockedGenerateObject.mockRejectedValueOnce('quota exceeded');

    const service = new GatewayPreDeparturePlannerService(FAKE_MODEL_ID);
    const outcome = await service.plan({
      trip: makeTrip(),
      destinations: [makeDestination({ id: 'd1' })],
      fixedCosts: [],
      currentDate: new Date('2026-05-15'),
    });

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.error).toContain('Unknown planner error');
  });
});
