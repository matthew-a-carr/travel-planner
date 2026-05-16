import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { DrizzleTripFixedCostRepository } from '@/infrastructure/db/repositories/drizzle-trip-fixed-cost-repository';
import {
  createTestDb,
  type Db,
  type Sql,
  seedFixedCost,
  seedTrip,
  seedUser,
  truncateAll,
} from '@/infrastructure/testing/helpers';
import { editFixedCost } from './edit-fixed-cost';

let db: Db;
let sql: Sql;

beforeAll(() => {
  ({ db, sql } = createTestDb());
});

afterAll(async () => {
  await sql.end();
});

beforeEach(async () => {
  await truncateAll(db);
});

describe('editFixedCost', () => {
  it('returns err when amount is zero', async () => {
    const fixedCostRepo = new DrizzleTripFixedCostRepository(db);

    const result = await editFixedCost(fixedCostRepo, {
      fixedCostId: crypto.randomUUID(),
      label: 'Flights',
      amountPence: 0,
      currency: 'GBP',
      category: 'transport',
      date: new Date(),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('greater than zero');
  });

  it('returns err when the fixed cost does not exist', async () => {
    const fixedCostRepo = new DrizzleTripFixedCostRepository(db);

    const result = await editFixedCost(fixedCostRepo, {
      fixedCostId: crypto.randomUUID(),
      label: 'Flights',
      amountPence: 50_000,
      currency: 'GBP',
      category: 'transport',
      date: new Date(),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('not found');
  });

  it('persists updated label, amount, category, and date', async () => {
    const { id: ownerId } = await seedUser(db);
    const trip = await seedTrip(db, ownerId);
    const existing = await seedFixedCost(db, trip.id, {
      label: 'Old Flights',
      amountPence: 50_000,
      category: 'transport',
      date: new Date('2026-01-15'),
    });
    const fixedCostRepo = new DrizzleTripFixedCostRepository(db);

    const result = await editFixedCost(fixedCostRepo, {
      fixedCostId: existing.id,
      label: 'Updated Flights',
      amountPence: 75_000,
      currency: 'GBP',
      category: 'bills',
      date: new Date('2026-06-01'),
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.label).toBe('Updated Flights');
      expect(result.value.amount.amountPence).toBe(75_000);
      expect(result.value.category).toBe('bills');
      expect(result.value.date.toISOString().split('T')[0]).toBe('2026-06-01');
    }
  });

  it('preserves sortOrder and createdAt from the original record', async () => {
    const { id: ownerId } = await seedUser(db);
    const trip = await seedTrip(db, ownerId);
    const existing = await seedFixedCost(db, trip.id, {
      label: 'Insurance',
      amountPence: 20_000,
      sortOrder: 5,
    });
    const fixedCostRepo = new DrizzleTripFixedCostRepository(db);

    const result = await editFixedCost(fixedCostRepo, {
      fixedCostId: existing.id,
      label: 'Updated Insurance',
      amountPence: 25_000,
      currency: 'GBP',
      category: 'insurance',
      date: new Date('2026-08-01'),
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.sortOrder).toBe(5);
      expect(result.value.createdAt.getTime()).toBe(existing.createdAt.getTime());
    }
  });

  it.each([
    { category: 'eating-out' as const },
    { category: 'subscriptions' as const },
    { category: 'healthcare' as const },
    { category: 'visas' as const },
  ])('persists updated category "$category"', async ({ category }) => {
    const { id: ownerId } = await seedUser(db);
    const trip = await seedTrip(db, ownerId);
    const existing = await seedFixedCost(db, trip.id, {
      label: 'Original',
      amountPence: 20_000,
      category: 'other',
    });
    const fixedCostRepo = new DrizzleTripFixedCostRepository(db);

    const result = await editFixedCost(fixedCostRepo, {
      fixedCostId: existing.id,
      label: `Updated to ${category}`,
      amountPence: 30_000,
      currency: 'GBP',
      category,
      date: new Date('2026-07-01'),
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.category).toBe(category);
    }
  });
});
