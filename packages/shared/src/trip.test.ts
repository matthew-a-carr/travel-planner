import { describe, expect, it } from 'vitest';
import {
  createDestinationRequestSchema,
  createFixedCostRequestSchema,
  createSpendRequestSchema,
  createTripRequestSchema,
  tripDetailSchema,
  tripFinancialsSchema,
  tripSummarySchema,
  updateDestinationRequestSchema,
  updateSpendRequestSchema,
  updateTripRequestSchema,
} from './trip';

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
    expect(() => tripSummarySchema.parse({ ...validSummary, startDate: '01/09/2026' })).toThrow();
    expect(() => tripSummarySchema.parse({ ...validSummary, startDate: '2026-9-1' })).toThrow();
  });

  it('rejects a non-RFC-3339 updatedAt', () => {
    expect(() =>
      tripSummarySchema.parse({ ...validSummary, updatedAt: '2026-05-30 12:34' }),
    ).toThrow();
  });
});

describe('spend and financial schemas (SPEC-024)', () => {
  const spend = {
    destinationId: '3d9482f5-f6e7-4a6f-8901-123456789abc',
    amountPence: 2500,
    category: 'food',
    description: 'Ramen',
    spentAt: '2026-09-02',
  };

  it('accepts spend commands and rejects invalid money, category, and dates', () => {
    expect(createSpendRequestSchema.parse(spend)).toEqual(spend);
    const { destinationId: _destinationId, ...update } = spend;
    expect(updateSpendRequestSchema.parse(update)).toEqual(update);
    expect(() => createSpendRequestSchema.parse({ ...spend, amountPence: 0 })).toThrow();
    expect(() => createSpendRequestSchema.parse({ ...spend, amountPence: 1.5 })).toThrow();
    expect(() => createSpendRequestSchema.parse({ ...spend, category: 'bribes' })).toThrow();
    expect(() => createSpendRequestSchema.parse({ ...spend, spentAt: '2026-02-30' })).toThrow();
  });

  it('parses the canonical financial read model', () => {
    const entry = {
      id: '4e9482f5-f6e7-4a6f-8901-123456789abc',
      destinationId: spend.destinationId,
      amount: { amountPence: 2500, currency: 'GBP' },
      category: 'food',
      description: 'Ramen',
      spentAt: '2026-09-02',
      createdAt: '2026-09-02T12:00:00.000Z',
    };
    const point = { date: '2026-09-02', amountPence: 97_500 };
    const financials = {
      entries: [entry],
      categoryTotals: [{ category: 'food', amountPence: 2500 }],
      burndown: {
        idealLine: [point],
        actualLine: [point],
        projectedLine: [point],
        dailyPacePence: 2500,
        targetPacePence: 5000,
        paceRatio: 0.5,
        projectedExhaustionDate: null,
      },
      alerts: [
        {
          type: 'single-day-spike',
          message: 'High spend day on 2 Sept',
          severity: 'warning',
        },
      ],
    };
    expect(tripFinancialsSchema.parse(financials)).toEqual(financials);
  });

  it('supports a trip without dated destinations or spend', () => {
    expect(
      tripFinancialsSchema.parse({ entries: [], categoryTotals: [], burndown: null, alerts: [] }),
    ).toEqual({ entries: [], categoryTotals: [], burndown: null, alerts: [] });
  });
});

const gbp = (amountPence: number) => ({ amountPence, currency: 'GBP' });

const validDetail = {
  ...validSummary,
  destinations: [
    {
      id: 'd1',
      name: 'Tokyo',
      country: 'Japan',
      city: 'Tokyo',
      latitude: 35.6762,
      longitude: 139.6503,
      startDate: '2026-09-01',
      endDate: '2026-09-10',
      estimatedBudget: gbp(250_000),
      comfortLevel: 'mid',
      sortOrder: 0,
      spent: gbp(12_345),
    },
    {
      id: 'd2',
      name: 'Kyoto',
      country: 'Japan',
      city: null,
      latitude: null,
      longitude: null,
      startDate: null,
      endDate: null,
      estimatedBudget: gbp(100_000),
      comfortLevel: 'budget',
      sortOrder: 1,
      spent: gbp(0),
    },
  ],
  fixedCosts: [
    {
      id: 'f1',
      label: 'Flights',
      amount: gbp(120_000),
      category: 'transport',
      date: '2026-08-15',
      sortOrder: 0,
    },
  ],
  spend: {
    totalBudget: gbp(500_000),
    fixedCosts: gbp(120_000),
    allocated: gbp(350_000),
    available: gbp(30_000),
    spent: gbp(12_345),
    isOverAllocated: false,
  },
};

describe('tripDetailSchema', () => {
  it('parses a valid detail payload', () => {
    expect(() => tripDetailSchema.parse(validDetail)).not.toThrow();
  });

  it('parses empty destinations and fixedCosts', () => {
    expect(() =>
      tripDetailSchema.parse({ ...validDetail, destinations: [], fixedCosts: [] }),
    ).not.toThrow();
  });

  it('allows a negative available amount (over-allocated trip)', () => {
    expect(() =>
      tripDetailSchema.parse({
        ...validDetail,
        spend: { ...validDetail.spend, available: gbp(-5_000), isOverAllocated: true },
      }),
    ).not.toThrow();
  });

  it('rejects a destination with an unknown comfort level', () => {
    const broken = {
      ...validDetail,
      destinations: [{ ...validDetail.destinations[0], comfortLevel: 'deluxe' }],
    };
    expect(() => tripDetailSchema.parse(broken)).toThrow();
  });

  it('rejects a fixed cost with an unknown category', () => {
    const broken = {
      ...validDetail,
      fixedCosts: [{ ...validDetail.fixedCosts[0], category: 'bribes' }],
    };
    expect(() => tripDetailSchema.parse(broken)).toThrow();
  });

  it('rejects a detail missing the spend summary', () => {
    const { spend: _spend, ...withoutSpend } = validDetail;
    expect(() => tripDetailSchema.parse(withoutSpend)).toThrow();
  });

  it('rejects a non-date destination startDate', () => {
    const broken = {
      ...validDetail,
      destinations: [{ ...validDetail.destinations[0], startDate: 'next month' }],
    };
    expect(() => tripDetailSchema.parse(broken)).toThrow();
  });
});

describe('trip command schemas', () => {
  const organizationId = '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';

  it('accepts create and update commands in integer pence', () => {
    expect(
      createTripRequestSchema.parse({ organizationId, name: 'Japan', totalBudgetPence: 500_000 }),
    ).toEqual({ organizationId, name: 'Japan', totalBudgetPence: 500_000 });
    expect(
      updateTripRequestSchema.parse({
        name: 'Japan 2027',
        totalBudgetPence: 600_000,
        status: 'active',
      }),
    ).toEqual({ name: 'Japan 2027', totalBudgetPence: 600_000, status: 'active' });
  });

  it('trims names and rejects empty names', () => {
    expect(
      createTripRequestSchema.parse({ organizationId, name: '  Japan  ', totalBudgetPence: 1 }),
    ).toMatchObject({ name: 'Japan' });
    expect(() =>
      createTripRequestSchema.parse({ organizationId, name: '   ', totalBudgetPence: 1 }),
    ).toThrow();
  });

  it('rejects non-positive or fractional pence', () => {
    for (const totalBudgetPence of [0, -1, 1.5]) {
      expect(() =>
        createTripRequestSchema.parse({ organizationId, name: 'Japan', totalBudgetPence }),
      ).toThrow();
    }
  });

  it('rejects unknown statuses and malformed organization IDs', () => {
    expect(() =>
      updateTripRequestSchema.parse({
        name: 'Japan',
        totalBudgetPence: 1,
        status: 'archived',
      }),
    ).toThrow();
    expect(() =>
      createTripRequestSchema.parse({
        organizationId: 'not-a-uuid',
        name: 'Japan',
        totalBudgetPence: 1,
      }),
    ).toThrow();
  });
});

describe('destination and fixed-cost command schemas', () => {
  const destination = {
    name: '',
    country: 'Japan',
    city: 'Tokyo',
    latitude: 35.6762,
    longitude: 139.6503,
    estimatedBudgetPence: 120_000,
    comfortLevel: 'mid',
    startDate: '2027-04-01',
    endDate: '2027-04-08',
  };

  it('accepts a destination with paired dates and coordinates', () => {
    expect(createDestinationRequestSchema.parse(destination)).toEqual(destination);
  });

  it('allows an inferred name on create but requires an explicit name on update', () => {
    expect(createDestinationRequestSchema.parse(destination).name).toBe('');
    expect(() => updateDestinationRequestSchema.parse(destination)).toThrow();
    expect(updateDestinationRequestSchema.parse({ ...destination, name: 'Tokyo' }).name).toBe(
      'Tokyo',
    );
  });

  it('rejects half a date or coordinate pair', () => {
    expect(() => createDestinationRequestSchema.parse({ ...destination, endDate: null })).toThrow();
    expect(() =>
      createDestinationRequestSchema.parse({ ...destination, longitude: null }),
    ).toThrow();
  });

  it('rejects invalid coordinate ranges and fractional pence', () => {
    expect(() => createDestinationRequestSchema.parse({ ...destination, latitude: 91 })).toThrow();
    expect(() =>
      createDestinationRequestSchema.parse({ ...destination, estimatedBudgetPence: 1.5 }),
    ).toThrow();
  });

  it('rejects impossible calendar dates', () => {
    expect(() =>
      createDestinationRequestSchema.parse({ ...destination, startDate: '2027-02-30' }),
    ).toThrow();
    expect(() =>
      createFixedCostRequestSchema.parse({
        label: 'Flights',
        amountPence: 1,
        category: 'transport',
        date: '2027-13-01',
      }),
    ).toThrow();
  });

  it('accepts categorised fixed costs and rejects invalid values', () => {
    const fixedCost = {
      label: 'Flights',
      amountPence: 50_000,
      category: 'transport',
      date: '2027-03-31',
    };
    expect(createFixedCostRequestSchema.parse(fixedCost)).toEqual(fixedCost);
    expect(() => createFixedCostRequestSchema.parse({ ...fixedCost, amountPence: 0 })).toThrow();
    expect(() => createFixedCostRequestSchema.parse({ ...fixedCost, category: 'misc' })).toThrow();
  });
});
