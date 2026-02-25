import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { DrizzleDestinationRepository } from '@/infrastructure/db/repositories/drizzle-destination-repository';
import { DrizzleSpendEntryRepository } from '@/infrastructure/db/repositories/drizzle-spend-entry-repository';
import {
  type Db,
  type Sql,
  createTestDb,
  seedDestination,
  seedTrip,
  seedUser,
  truncateAll,
} from '@/infrastructure/testing/helpers';
import { recordSpend } from './record-spend';

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

const baseInput = {
  amountPence: 5_000,
  currency: 'GBP' as const,
  category: 'food' as const,
  description: null,
  spentAt: new Date('2026-06-15'),
};

describe('recordSpend', () => {
  it('returns err when amount is zero', async () => {
    const destRepo = new DrizzleDestinationRepository(db);
    const spendRepo = new DrizzleSpendEntryRepository(db);

    const result = await recordSpend(destRepo, spendRepo, {
      destinationId: crypto.randomUUID(),
      ...baseInput,
      amountPence: 0,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('greater than zero');
  });

  it('returns err when amount is negative', async () => {
    const destRepo = new DrizzleDestinationRepository(db);
    const spendRepo = new DrizzleSpendEntryRepository(db);

    const result = await recordSpend(destRepo, spendRepo, {
      destinationId: crypto.randomUUID(),
      ...baseInput,
      amountPence: -1,
    });

    expect(result.ok).toBe(false);
  });

  it('returns err when the destination does not exist', async () => {
    const destRepo = new DrizzleDestinationRepository(db);
    const spendRepo = new DrizzleSpendEntryRepository(db);

    const result = await recordSpend(destRepo, spendRepo, {
      destinationId: crypto.randomUUID(),
      ...baseInput,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('not found');
  });

  it('saves a valid spend entry and returns it', async () => {
    const { id: ownerId } = await seedUser(db);
    const trip = await seedTrip(db, ownerId);
    const dest = await seedDestination(db, trip.id);
    const destRepo = new DrizzleDestinationRepository(db);
    const spendRepo = new DrizzleSpendEntryRepository(db);

    const result = await recordSpend(destRepo, spendRepo, {
      destinationId: dest.id,
      ...baseInput,
      amountPence: 12_050,
      category: 'transport',
      description: 'Train to Kyoto',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.destinationId).toBe(dest.id);
      expect(result.value.amount.amountPence).toBe(12_050);
      expect(result.value.category).toBe('transport');
      expect(result.value.description).toBe('Train to Kyoto');
    }
  });

  it('persists the entry so it is readable via findByDestination', async () => {
    const { id: ownerId } = await seedUser(db);
    const trip = await seedTrip(db, ownerId);
    const dest = await seedDestination(db, trip.id);
    const destRepo = new DrizzleDestinationRepository(db);
    const spendRepo = new DrizzleSpendEntryRepository(db);

    await recordSpend(destRepo, spendRepo, { destinationId: dest.id, ...baseInput });

    const entries = await spendRepo.findByDestination(dest.id);
    expect(entries).toHaveLength(1);
  });
});
