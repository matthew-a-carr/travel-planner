import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { money } from '../../../domain/trip/types';
import {
  createTestDb,
  type Db,
  type Sql,
  seedDestination,
  seedTrip,
  seedUser,
  truncateAll,
} from '../../../infrastructure/testing/helpers';
import { DrizzleDestinationRepository } from './drizzle-destination-repository';

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

describe('DrizzleDestinationRepository', () => {
  describe('findById', () => {
    it('returns null for an unknown id', async () => {
      const repo = new DrizzleDestinationRepository(db);
      expect(await repo.findById(crypto.randomUUID())).toBeNull();
    });

    it('returns the mapped Destination for an existing id', async () => {
      const { id: ownerId } = await seedUser(db);
      const trip = await seedTrip(db, ownerId);
      const dest = await seedDestination(db, trip.id, {
        name: 'Kyoto',
        country: 'Japan',
        estimatedBudgetPence: 800_000,
      });

      const repo = new DrizzleDestinationRepository(db);
      const found = await repo.findById(dest.id);
      expect(found?.name).toBe('Kyoto');
      expect(found?.country).toBe('Japan');
      expect(found?.estimatedBudget.amountPence).toBe(800_000);
    });

    it('round-trips startDate and endDate as Date objects', async () => {
      const { id: ownerId } = await seedUser(db);
      const trip = await seedTrip(db, ownerId);
      const start = new Date('2026-06-01');
      const end = new Date('2026-06-30');
      const dest = await seedDestination(db, trip.id, { startDate: start, endDate: end });

      const repo = new DrizzleDestinationRepository(db);
      const found = await repo.findById(dest.id);
      expect(found?.startDate?.toISOString().split('T')[0]).toBe('2026-06-01');
      expect(found?.endDate?.toISOString().split('T')[0]).toBe('2026-06-30');
    });

    it('returns null startDate and endDate when not set', async () => {
      const { id: ownerId } = await seedUser(db);
      const trip = await seedTrip(db, ownerId);
      const dest = await seedDestination(db, trip.id);

      const repo = new DrizzleDestinationRepository(db);
      const found = await repo.findById(dest.id);
      expect(found?.startDate).toBeNull();
      expect(found?.endDate).toBeNull();
    });
  });

  describe('findByTrip', () => {
    it('returns an empty array for a trip with no destinations', async () => {
      const { id: ownerId } = await seedUser(db);
      const trip = await seedTrip(db, ownerId);
      const repo = new DrizzleDestinationRepository(db);
      expect(await repo.findByTrip(trip.id)).toEqual([]);
    });

    it('returns only destinations belonging to the given trip', async () => {
      const { id: ownerId } = await seedUser(db);
      const trip1 = await seedTrip(db, ownerId);
      const trip2 = await seedTrip(db, ownerId);
      await seedDestination(db, trip1.id, { name: 'Belongs to trip1' });
      await seedDestination(db, trip2.id, { name: 'Belongs to trip2' });

      const repo = new DrizzleDestinationRepository(db);
      const result = await repo.findByTrip(trip1.id);
      expect(result).toHaveLength(1);
      expect(result[0]?.name).toBe('Belongs to trip1');
    });

    it('returns destinations ordered by sortOrder ascending', async () => {
      const { id: ownerId } = await seedUser(db);
      const trip = await seedTrip(db, ownerId);
      await seedDestination(db, trip.id, { name: 'C', sortOrder: 2 });
      await seedDestination(db, trip.id, { name: 'A', sortOrder: 0 });
      await seedDestination(db, trip.id, { name: 'B', sortOrder: 1 });

      const repo = new DrizzleDestinationRepository(db);
      const result = await repo.findByTrip(trip.id);
      expect(result.map((d) => d.name)).toEqual(['A', 'B', 'C']);
    });
  });

  describe('save', () => {
    it('inserts a new destination and returns it', async () => {
      const { id: ownerId } = await seedUser(db);
      const trip = await seedTrip(db, ownerId);
      const now = new Date();
      const id = crypto.randomUUID();
      const repo = new DrizzleDestinationRepository(db);

      const saved = await repo.save({
        id,
        tripId: trip.id,
        name: 'Osaka',
        country: 'Japan',
        city: null,
        latitude: null,
        longitude: null,
        estimatedBudget: money(600_000, 'GBP'),
        comfortLevel: 'mid',
        startDate: null,
        endDate: null,
        sortOrder: 0,
        createdAt: now,
        updatedAt: now,
      });

      expect(saved.id).toBe(id);
      expect(saved.name).toBe('Osaka');
      expect(saved.estimatedBudget.amountPence).toBe(600_000);
    });

    it('upserts an existing destination — name and budget are updated', async () => {
      const { id: ownerId } = await seedUser(db);
      const trip = await seedTrip(db, ownerId);
      const dest = await seedDestination(db, trip.id, {
        name: 'Old Name',
        estimatedBudgetPence: 500_000,
      });

      const repo = new DrizzleDestinationRepository(db);
      const updated = await repo.save({
        ...dest,
        name: 'New Name',
        estimatedBudget: money(700_000, 'GBP'),
        updatedAt: new Date(),
      });

      expect(updated.id).toBe(dest.id);
      expect(updated.name).toBe('New Name');
      expect(updated.estimatedBudget.amountPence).toBe(700_000);
    });
  });

  describe('delete', () => {
    it('removes the destination; subsequent findById returns null', async () => {
      const { id: ownerId } = await seedUser(db);
      const trip = await seedTrip(db, ownerId);
      const dest = await seedDestination(db, trip.id);

      const repo = new DrizzleDestinationRepository(db);
      await repo.delete(dest.id);
      expect(await repo.findById(dest.id)).toBeNull();
    });

    it('is a no-op for a non-existent id', async () => {
      const repo = new DrizzleDestinationRepository(db);
      await expect(repo.delete(crypto.randomUUID())).resolves.toBeUndefined();
    });
  });
});
