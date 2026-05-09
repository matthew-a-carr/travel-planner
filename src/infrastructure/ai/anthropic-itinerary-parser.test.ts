import type { LanguageModel } from 'ai';
import { generateObject } from 'ai';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AnthropicItineraryParser } from './anthropic-itinerary-parser';

vi.mock('ai', () => ({
  generateObject: vi.fn(),
}));

const mockedGenerateObject = vi.mocked(generateObject);

const fakeModel = {} as LanguageModel;

const baseInput = {
  text: '3 weeks Vietnam from Aug 1, then Cambodia for 10 days',
  referenceDate: '2026-05-09',
  knownCountries: ['Vietnam', 'Cambodia'],
};

beforeEach(() => {
  mockedGenerateObject.mockReset();
});

describe('AnthropicItineraryParser', () => {
  it('returns ok with parsed rows when generateObject succeeds', async () => {
    mockedGenerateObject.mockResolvedValueOnce({
      object: {
        rows: [
          {
            country: 'Vietnam',
            city: 'Hanoi',
            startDate: '2026-08-01',
            endDate: '2026-08-22',
            comfortLevel: 'mid',
            confidence: 'high',
            notes: null,
          },
        ],
        unresolved: [],
      },
    } as Awaited<ReturnType<typeof generateObject>>);

    const parser = new AnthropicItineraryParser(fakeModel);
    const outcome = await parser.parse(baseInput);

    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.result.rows).toHaveLength(1);
      const row = outcome.result.rows[0];
      expect(row.country).toBe('Vietnam');
      expect(row.startDate?.toISOString().slice(0, 10)).toBe('2026-08-01');
      expect(row.endDate?.toISOString().slice(0, 10)).toBe('2026-08-22');
      expect(row.suggestedBudgetPence).toBeNull();
    }
  });

  it('returns a typed error when generateObject throws (network / rate-limit / etc.)', async () => {
    mockedGenerateObject.mockRejectedValueOnce(new Error('fetch failed: ECONNREFUSED'));

    const parser = new AnthropicItineraryParser(fakeModel);
    const outcome = await parser.parse(baseInput);

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.error).toContain('Itinerary parser failed');
      expect(outcome.error).toContain('ECONNREFUSED');
    }
  });

  it('returns a typed error when generateObject throws a non-Error value', async () => {
    mockedGenerateObject.mockRejectedValueOnce('rate limited');

    const parser = new AnthropicItineraryParser(fakeModel);
    const outcome = await parser.parse(baseInput);

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.error).toContain('Unknown parser error');
    }
  });

  it('passes nullable date and comfort fields through cleanly', async () => {
    mockedGenerateObject.mockResolvedValueOnce({
      object: {
        rows: [
          {
            country: 'Laos',
            city: null,
            startDate: null,
            endDate: null,
            comfortLevel: null,
            confidence: 'low',
            notes: 'Implied from "Laos a week"',
          },
        ],
        unresolved: ['random fragment'],
      },
    } as Awaited<ReturnType<typeof generateObject>>);

    const parser = new AnthropicItineraryParser(fakeModel);
    const outcome = await parser.parse(baseInput);

    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      const row = outcome.result.rows[0];
      expect(row.startDate).toBeNull();
      expect(row.endDate).toBeNull();
      expect(row.comfortLevel).toBeNull();
      expect(row.confidence).toBe('low');
      expect(outcome.result.unresolved).toEqual(['random fragment']);
    }
  });
});
