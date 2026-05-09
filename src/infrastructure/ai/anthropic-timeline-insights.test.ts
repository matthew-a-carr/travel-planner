import { generateObject } from 'ai';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Destination, TripFixedCost } from '@/domain/trip/types';
import { moneyUnchecked } from '@/domain/trip/types';
import { AnthropicTimelineInsights } from './anthropic-timeline-insights';

vi.mock('ai', () => ({
  generateObject: vi.fn(),
}));

const mockedGenerateObject = vi.mocked(generateObject);

const FAKE_MODEL_ID = 'anthropic/claude-sonnet-4-6';

function makeDestination(overrides: Partial<Destination> & { id: string }): Destination {
  return {
    tripId: 'trip-1',
    name: `dest-${overrides.id}`,
    country: 'Indonesia',
    city: 'Bali',
    latitude: null,
    longitude: null,
    estimatedBudget: moneyUnchecked(100_000, 'GBP'),
    comfortLevel: 'mid',
    startDate: new Date('2026-11-01'),
    endDate: new Date('2026-11-10'),
    sortOrder: 0,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

const fixedCost: TripFixedCost = {
  id: 'fc-1',
  tripId: 'trip-1',
  label: 'Flights',
  amount: moneyUnchecked(120_000, 'GBP'),
  category: 'transport',
  date: new Date('2026-11-01'),
  sortOrder: 0,
  createdAt: new Date('2026-01-01'),
};

beforeEach(() => {
  mockedGenerateObject.mockReset();
});

describe('AnthropicTimelineInsights', () => {
  it('returns ok with findings when generateObject succeeds', async () => {
    mockedGenerateObject.mockResolvedValueOnce({
      object: {
        findings: [
          {
            stopId: 'd1',
            severity: 'warning',
            kind: 'seasonality',
            message: 'Bali in November falls in the wet season.',
            suggestion: 'Consider rearranging.',
          },
        ],
      },
    } as Awaited<ReturnType<typeof generateObject>>);

    const insights = new AnthropicTimelineInsights(FAKE_MODEL_ID);
    const outcome = await insights.analyse({
      destinations: [makeDestination({ id: 'd1' })],
      fixedCosts: [fixedCost],
    });

    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.findings).toHaveLength(1);
      expect(outcome.findings[0].kind).toBe('seasonality');
      expect(outcome.findings[0].stopId).toBe('d1');
    }
  });

  it('returns a typed error when generateObject throws', async () => {
    mockedGenerateObject.mockRejectedValueOnce(new Error('fetch failed: gateway timeout'));

    const insights = new AnthropicTimelineInsights(FAKE_MODEL_ID);
    const outcome = await insights.analyse({
      destinations: [makeDestination({ id: 'd1' })],
      fixedCosts: [],
    });

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.error).toContain('Timeline insights failed');
      expect(outcome.error).toContain('gateway timeout');
    }
  });

  it('short-circuits without calling the model when no destinations are dated', async () => {
    const insights = new AnthropicTimelineInsights(FAKE_MODEL_ID);
    const outcome = await insights.analyse({
      destinations: [
        makeDestination({ id: 'd1', startDate: null, endDate: null }),
      ],
      fixedCosts: [],
    });

    expect(outcome.ok).toBe(true);
    if (outcome.ok) expect(outcome.findings).toEqual([]);
    expect(mockedGenerateObject).not.toHaveBeenCalled();
  });

  it('returns a typed error when generateObject throws a non-Error value', async () => {
    mockedGenerateObject.mockRejectedValueOnce('quota exceeded');

    const insights = new AnthropicTimelineInsights(FAKE_MODEL_ID);
    const outcome = await insights.analyse({
      destinations: [makeDestination({ id: 'd1' })],
      fixedCosts: [],
    });

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.error).toContain('Unknown insights error');
  });
});
