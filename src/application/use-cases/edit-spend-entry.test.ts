import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { DrizzleSpendEntryRepository } from '@/infrastructure/db/repositories/drizzle-spend-entry-repository';
import {
  type Db,
  type Sql,
  createTestDb,
  seedDestination,
  seedSpendEntry,
  seedTrip,
  seedUser,
  truncateAll,
} from '@/infrastructure/testing/helpers';
import { editSpendEntry } from './edit-spend-entry';

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

describe('editSpendEntry', () => {
  it('returns err when amount is zero', async () => {
    const spendRepo = new DrizzleSpendEntryRepository(db);

    const result = await editSpendEntry(spendRepo, {
      entryId: crypto.randomUUID(),
      amountPence: 0,
      currency: 'GBP',
      category: 'food',
      description: null,
      spentAt: new Date(),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('greater than zero');
  });

  it('returns err when the entry does not exist', async () => {
    const spendRepo = new DrizzleSpendEntryRepository(db);

    const result = await editSpendEntry(spendRepo, {
      entryId: crypto.randomUUID(),
      amountPence: 5_000,
      currency: 'GBP',
      category: 'food',
      description: null,
      spentAt: new Date(),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('not found');
  });

  it('persists updated amount, category, and description', async () => {
    const { id: ownerId } = await seedUser(db);
    const trip = await seedTrip(db, ownerId);
    const dest = await seedDestination(db, trip.id);
    const entry = await seedSpendEntry(db, dest.id, {
      amountPence: 5_000,
      category: 'food',
      description: 'Old description',
    });
    const spendRepo = new DrizzleSpendEntryRepository(db);

    const result = await editSpendEntry(spendRepo, {
      entryId: entry.id,
      amountPence: 9_999,
      currency: 'GBP',
      category: 'accommodation',
      description: 'New description',
      spentAt: entry.spentAt,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.amount.amountPence).toBe(9_999);
      expect(result.value.category).toBe('accommodation');
      expect(result.value.description).toBe('New description');
    }
  });
});
