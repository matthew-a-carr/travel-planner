import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { DrizzleSpendEntryRepository } from './drizzle-spend-entry-repository';
import {
  type Db,
  type Sql,
  createTestDb,
  seedDestination,
  seedSpendEntry,
  seedTrip,
  seedUser,
  truncateAll,
} from '../../../infrastructure/testing/helpers';
import { money } from '../../../domain/trip/types';

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

describe('DrizzleSpendEntryRepository', () => {
  describe('findById', () => {
    it('returns null for an unknown id', async () => {
      const repo = new DrizzleSpendEntryRepository(db);
      expect(await repo.findById(crypto.randomUUID())).toBeNull();
    });

    it('returns the mapped SpendEntry for an existing id', async () => {
      const { id: ownerId } = await seedUser(db);
      const trip = await seedTrip(db, ownerId);
      const dest = await seedDestination(db, trip.id);
      const entry = await seedSpendEntry(db, dest.id, {
        amountPence: 12_000,
        category: 'food',
        description: 'Ramen',
      });

      const repo = new DrizzleSpendEntryRepository(db);
      const found = await repo.findById(entry.id);
      expect(found?.amount.amountPence).toBe(12_000);
      expect(found?.category).toBe('food');
      expect(found?.description).toBe('Ramen');
    });

    it('maps spentAt as a Date', async () => {
      const { id: ownerId } = await seedUser(db);
      const trip = await seedTrip(db, ownerId);
      const dest = await seedDestination(db, trip.id);
      const entry = await seedSpendEntry(db, dest.id, { spentAt: new Date('2026-07-10') });

      const repo = new DrizzleSpendEntryRepository(db);
      const found = await repo.findById(entry.id);
      expect(found?.spentAt.toISOString().split('T')[0]).toBe('2026-07-10');
    });
  });

  describe('findByDestination', () => {
    it('returns entries ordered by spentAt ascending', async () => {
      const { id: ownerId } = await seedUser(db);
      const trip = await seedTrip(db, ownerId);
      const dest = await seedDestination(db, trip.id);
      await seedSpendEntry(db, dest.id, { spentAt: new Date('2026-07-20'), description: 'Later' });
      await seedSpendEntry(db, dest.id, { spentAt: new Date('2026-07-01'), description: 'Earlier' });

      const repo = new DrizzleSpendEntryRepository(db);
      const result = await repo.findByDestination(dest.id);
      expect(result.map((e) => e.description)).toEqual(['Earlier', 'Later']);
    });

    it('returns only entries for the given destination', async () => {
      const { id: ownerId } = await seedUser(db);
      const trip = await seedTrip(db, ownerId);
      const dest1 = await seedDestination(db, trip.id, { name: 'Japan' });
      const dest2 = await seedDestination(db, trip.id, { name: 'Thailand', sortOrder: 1 });
      await seedSpendEntry(db, dest1.id, { description: 'Japan entry' });
      await seedSpendEntry(db, dest2.id, { description: 'Thailand entry' });

      const repo = new DrizzleSpendEntryRepository(db);
      const result = await repo.findByDestination(dest1.id);
      expect(result).toHaveLength(1);
      expect(result[0]?.description).toBe('Japan entry');
    });
  });

  describe('findByTrip', () => {
    it('returns all entries across destinations for a trip', async () => {
      const { id: ownerId } = await seedUser(db);
      const trip = await seedTrip(db, ownerId);
      const dest1 = await seedDestination(db, trip.id, { name: 'Japan' });
      const dest2 = await seedDestination(db, trip.id, { name: 'Thailand', sortOrder: 1 });
      await seedSpendEntry(db, dest1.id);
      await seedSpendEntry(db, dest2.id);

      const repo = new DrizzleSpendEntryRepository(db);
      const result = await repo.findByTrip(trip.id);
      expect(result).toHaveLength(2);
    });

    it('does not include entries from other trips', async () => {
      const { id: ownerId } = await seedUser(db);
      const trip1 = await seedTrip(db, ownerId);
      const trip2 = await seedTrip(db, ownerId);
      const dest1 = await seedDestination(db, trip1.id);
      const dest2 = await seedDestination(db, trip2.id);
      await seedSpendEntry(db, dest1.id, { description: 'Trip 1 entry' });
      await seedSpendEntry(db, dest2.id, { description: 'Trip 2 entry' });

      const repo = new DrizzleSpendEntryRepository(db);
      const result = await repo.findByTrip(trip1.id);
      expect(result).toHaveLength(1);
      expect(result[0]?.description).toBe('Trip 1 entry');
    });
  });

  describe('save', () => {
    it('inserts a new entry and returns it with correct fields', async () => {
      const { id: ownerId } = await seedUser(db);
      const trip = await seedTrip(db, ownerId);
      const dest = await seedDestination(db, trip.id);
      const id = crypto.randomUUID();
      const repo = new DrizzleSpendEntryRepository(db);

      const saved = await repo.save({
        id,
        destinationId: dest.id,
        amount: money(8_000, 'GBP'),
        category: 'transport',
        description: 'Train ticket',
        spentAt: new Date('2026-06-15'),
        createdAt: new Date(),
      });

      expect(saved.id).toBe(id);
      expect(saved.amount.amountPence).toBe(8_000);
      expect(saved.category).toBe('transport');
      expect(saved.description).toBe('Train ticket');
    });

    it('upserts an existing entry — amount, category, description are updated', async () => {
      const { id: ownerId } = await seedUser(db);
      const trip = await seedTrip(db, ownerId);
      const dest = await seedDestination(db, trip.id);
      const entry = await seedSpendEntry(db, dest.id, { amountPence: 5_000, description: 'Old' });

      const repo = new DrizzleSpendEntryRepository(db);
      const updated = await repo.save({
        ...entry,
        amount: money(9_000, 'GBP'),
        description: 'New',
      });

      expect(updated.id).toBe(entry.id);
      expect(updated.amount.amountPence).toBe(9_000);
      expect(updated.description).toBe('New');
    });
  });

  describe('delete', () => {
    it('removes the entry; subsequent findById returns null', async () => {
      const { id: ownerId } = await seedUser(db);
      const trip = await seedTrip(db, ownerId);
      const dest = await seedDestination(db, trip.id);
      const entry = await seedSpendEntry(db, dest.id);

      const repo = new DrizzleSpendEntryRepository(db);
      await repo.delete(entry.id);
      expect(await repo.findById(entry.id)).toBeNull();
    });
  });
});
