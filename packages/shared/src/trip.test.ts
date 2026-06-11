import { describe, expect, it } from 'vitest';
import { tripSummarySchema } from './trip';

const validSummary = {
  id: '7f8b2c1a-0d9e-4f3a-8b6c-5d4e3f2a1b0c',
  name: 'Japan 2026',
  status: 'planning',
  totalBudget: { amountPence: 500_000, currency: 'GBP' },
  startDate: '2026-09-01',
  endDate: '2026-09-21',
  organizationId: '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d',
  updatedAt: '2026-05-30T12:34:56.789Z',
};

describe('tripSummarySchema', () => {
  it('parses a valid summary with both dates present', () => {
    expect(() => tripSummarySchema.parse(validSummary)).not.toThrow();
  });

  it('parses a summary with null startDate and endDate (trip with no dated destinations)', () => {
    expect(() =>
      tripSummarySchema.parse({ ...validSummary, startDate: null, endDate: null }),
    ).not.toThrow();
  });

  it('parses independently-nullable dates (only one side present)', () => {
    expect(() => tripSummarySchema.parse({ ...validSummary, endDate: null })).not.toThrow();
    expect(() => tripSummarySchema.parse({ ...validSummary, startDate: null })).not.toThrow();
  });

  it('accepts every trip status and every currency', () => {
    for (const status of ['planning', 'active', 'completed']) {
      expect(() => tripSummarySchema.parse({ ...validSummary, status })).not.toThrow();
    }
    for (const currency of ['GBP', 'USD', 'EUR', 'AUD']) {
      expect(() =>
        tripSummarySchema.parse({
          ...validSummary,
          totalBudget: { amountPence: 1, currency },
        }),
      ).not.toThrow();
    }
  });

  it('rejects an unknown status', () => {
    expect(() => tripSummarySchema.parse({ ...validSummary, status: 'archived' })).toThrow();
  });

  it('rejects a missing budget', () => {
    const { totalBudget: _totalBudget, ...withoutBudget } = validSummary;
    expect(() => tripSummarySchema.parse(withoutBudget)).toThrow();
  });

  it('rejects a non-integer pence amount', () => {
    expect(() =>
      tripSummarySchema.parse({
        ...validSummary,
        totalBudget: { amountPence: 12.5, currency: 'GBP' },
      }),
    ).toThrow();
  });

  it('rejects non-ISO date strings', () => {
    expect(() =>
      tripSummarySchema.parse({ ...validSummary, startDate: '01/09/2026' }),
    ).toThrow();
    expect(() =>
      tripSummarySchema.parse({ ...validSummary, startDate: '2026-9-1' }),
    ).toThrow();
  });

  it('rejects a non-RFC-3339 updatedAt', () => {
    expect(() =>
      tripSummarySchema.parse({ ...validSummary, updatedAt: '2026-05-30 12:34' }),
    ).toThrow();
  });
});
