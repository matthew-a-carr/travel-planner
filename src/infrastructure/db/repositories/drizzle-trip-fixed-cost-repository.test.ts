import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { DrizzleTripFixedCostRepository } from './drizzle-trip-fixed-cost-repository';
import {
  type Db,
  type Sql,
  createTestDb,
  seedFixedCost,
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

describe('DrizzleTripFixedCostRepository', () => {
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

    it('maps amount and currency correctly', async () => {
      const { id: ownerId } = await seedUser(db);
      const trip = await seedTrip(db, ownerId);
      await seedFixedCost(db, trip.id, { amountPence: 95_000 });

      const repo = new DrizzleTripFixedCostRepository(db);
      const result = await repo.findByTrip(trip.id);
      expect(result[0]?.amount.amountPence).toBe(95_000);
      expect(result[0]?.amount.currency).toBe('GBP');
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
        sortOrder: 0,
        createdAt: new Date(),
      });

      expect(saved.id).toBe(id);
      expect(saved.label).toBe('Flights to Asia');
      expect(saved.amount.amountPence).toBe(95_000);
      expect(saved.tripId).toBe(trip.id);
    });

    it('upserts an existing fixed cost — label and amount are updated', async () => {
      const { id: ownerId } = await seedUser(db);
      const trip = await seedTrip(db, ownerId);
      const fc = await seedFixedCost(db, trip.id, { label: 'Old Label', amountPence: 50_000 });

      const repo = new DrizzleTripFixedCostRepository(db);
      const updated = await repo.save({
        ...fc,
        label: 'New Label',
        amount: money(75_000, 'GBP'),
      });

      expect(updated.id).toBe(fc.id);
      expect(updated.label).toBe('New Label');
      expect(updated.amount.amountPence).toBe(75_000);
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
