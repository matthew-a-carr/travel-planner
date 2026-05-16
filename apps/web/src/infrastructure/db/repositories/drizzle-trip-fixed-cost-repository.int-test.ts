import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { moneyUnchecked as money } from '../../../domain/trip/types';
import {
  createTestDb,
  type Db,
  type Sql,
  seedFixedCost,
  seedTrip,
  seedUser,
  truncateAll,
} from '../../../infrastructure/testing/helpers';
import { DrizzleTripFixedCostRepository } from './drizzle-trip-fixed-cost-repository';

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

describe('DrizzleTripFixedCostRepository', () => {
  describe('findById', () => {
    it('returns null for a non-existent id', async () => {
      const repo = new DrizzleTripFixedCostRepository(db);
      expect(await repo.findById(crypto.randomUUID())).toBeNull();
    });

    it('returns the correct fixed cost by id', async () => {
      const { id: ownerId } = await seedUser(db);
      const trip = await seedTrip(db, ownerId);
      const fc = await seedFixedCost(db, trip.id, {
        label: 'Insurance',
        amountPence: 30_000,
        category: 'insurance',
      });

      const repo = new DrizzleTripFixedCostRepository(db);
      const result = await repo.findById(fc.id);

      expect(result).not.toBeNull();
      expect(result?.id).toBe(fc.id);
      expect(result?.label).toBe('Insurance');
      expect(result?.amount.amountPence).toBe(30_000);
      expect(result?.category).toBe('insurance');
    });
  });

  describe('findByTrip', () => {
    it('returns an empty array when the trip has no fixed costs', async () => {
      const { id: ownerId } = await seedUser(db);
      const trip = await seedTrip(db, ownerId);
      const repo = new DrizzleTripFixedCostRepository(db);
      expect(await repo.findByTrip(trip.id)).toEqual([]);
    });

    it('returns only fixed costs belonging to the given trip', async () => {
      const { id: ownerId } = await seedUser(db);
      const trip1 = await seedTrip(db, ownerId);
      const trip2 = await seedTrip(db, ownerId);
      await seedFixedCost(db, trip1.id, { label: 'Trip1 Flights' });
      await seedFixedCost(db, trip2.id, { label: 'Trip2 Insurance' });

      const repo = new DrizzleTripFixedCostRepository(db);
      const result = await repo.findByTrip(trip1.id);
      expect(result).toHaveLength(1);
      expect(result[0]?.label).toBe('Trip1 Flights');
    });

    it('returns fixed costs ordered by sortOrder ascending', async () => {
      const { id: ownerId } = await seedUser(db);
      const trip = await seedTrip(db, ownerId);
      await seedFixedCost(db, trip.id, { label: 'C', sortOrder: 2 });
      await seedFixedCost(db, trip.id, { label: 'A', sortOrder: 0 });
      await seedFixedCost(db, trip.id, { label: 'B', sortOrder: 1 });

      const repo = new DrizzleTripFixedCostRepository(db);
      const result = await repo.findByTrip(trip.id);
      expect(result.map((fc) => fc.label)).toEqual(['A', 'B', 'C']);
    });

    it('maps amount, currency, category, and date correctly', async () => {
      const { id: ownerId } = await seedUser(db);
      const trip = await seedTrip(db, ownerId);
      await seedFixedCost(db, trip.id, {
        amountPence: 95_000,
        category: 'fuel',
        date: new Date('2026-06-15'),
      });

      const repo = new DrizzleTripFixedCostRepository(db);
      const result = await repo.findByTrip(trip.id);
      expect(result[0]?.amount.amountPence).toBe(95_000);
      expect(result[0]?.amount.currency).toBe('GBP');
      expect(result[0]?.category).toBe('fuel');
      expect(result[0]?.date.toISOString().split('T')[0]).toBe('2026-06-15');
    });
  });

  describe('save', () => {
    it('inserts a new fixed cost and returns it with correct fields', async () => {
      const { id: ownerId } = await seedUser(db);
      const trip = await seedTrip(db, ownerId);
      const id = crypto.randomUUID();
      const repo = new DrizzleTripFixedCostRepository(db);

      const saved = await repo.save({
        id,
        tripId: trip.id,
        label: 'Flights to Asia',
        amount: money(95_000, 'GBP'),
        category: 'transport',
        date: new Date('2026-07-01'),
        sortOrder: 0,
        createdAt: new Date(),
      });

      expect(saved.id).toBe(id);
      expect(saved.label).toBe('Flights to Asia');
      expect(saved.amount.amountPence).toBe(95_000);
      expect(saved.category).toBe('transport');
      expect(saved.tripId).toBe(trip.id);
    });

    it('upserts an existing fixed cost — label, amount, category, and date are updated', async () => {
      const { id: ownerId } = await seedUser(db);
      const trip = await seedTrip(db, ownerId);
      const fc = await seedFixedCost(db, trip.id, {
        label: 'Old Label',
        amountPence: 50_000,
        category: 'other',
        date: new Date('2026-01-01'),
      });

      const repo = new DrizzleTripFixedCostRepository(db);
      const updated = await repo.save({
        ...fc,
        label: 'New Label',
        amount: money(75_000, 'GBP'),
        category: 'bills',
        date: new Date('2026-08-15'),
      });

      expect(updated.id).toBe(fc.id);
      expect(updated.label).toBe('New Label');
      expect(updated.amount.amountPence).toBe(75_000);
      expect(updated.category).toBe('bills');
      expect(updated.date.toISOString().split('T')[0]).toBe('2026-08-15');
    });
  });

  describe('delete', () => {
    it('removes the fixed cost; findByTrip excludes it', async () => {
      const { id: ownerId } = await seedUser(db);
      const trip = await seedTrip(db, ownerId);
      const fc = await seedFixedCost(db, trip.id);

      const repo = new DrizzleTripFixedCostRepository(db);
      await repo.delete(fc.id);
      const remaining = await repo.findByTrip(trip.id);
      expect(remaining).toHaveLength(0);
    });

    it('is a no-op for a non-existent id', async () => {
      const repo = new DrizzleTripFixedCostRepository(db);
      await expect(repo.delete(crypto.randomUUID())).resolves.toBeUndefined();
    });
  });
});
