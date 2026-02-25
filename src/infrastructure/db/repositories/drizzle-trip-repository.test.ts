import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { DrizzleTripRepository } from './drizzle-trip-repository';
import {
  type Db,
  type Sql,
  createTestDb,
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

describe('DrizzleTripRepository', () => {
  describe('findById', () => {
    it('returns null for an unknown id', async () => {
      const repo = new DrizzleTripRepository(db);
      const result = await repo.findById(crypto.randomUUID());
      expect(result).toBeNull();
    });

    it('returns the mapped Trip for an existing id', async () => {
      const { id: ownerId } = await seedUser(db);
      const now = new Date();
      const repo = new DrizzleTripRepository(db);
      const saved = await repo.save({
        id: crypto.randomUUID(),
        ownerId,
        name: 'Tokyo Express',
        totalBudget: money(2_000_000, 'GBP'),
        status: 'planning',
        createdAt: now,
        updatedAt: now,
      });

      const found = await repo.findById(saved.id);
      expect(found).not.toBeNull();
      expect(found?.name).toBe('Tokyo Express');
      expect(found?.totalBudget.amountPence).toBe(2_000_000);
      expect(found?.totalBudget.currency).toBe('GBP');
      expect(found?.status).toBe('planning');
      expect(found?.ownerId).toBe(ownerId);
    });
  });

  describe('findAllByOwner', () => {
    it('returns an empty array when the owner has no trips', async () => {
      const { id: ownerId } = await seedUser(db);
      const repo = new DrizzleTripRepository(db);
      const result = await repo.findAllByOwner(ownerId);
      expect(result).toEqual([]);
    });

    it('returns only trips belonging to the given owner', async () => {
      const { id: owner1 } = await seedUser(db);
      const { id: owner2 } = await seedUser(db);
      const repo = new DrizzleTripRepository(db);
      const now = new Date();

      await repo.save({
        id: crypto.randomUUID(),
        ownerId: owner1,
        name: 'Trip A',
        totalBudget: money(1_000_000, 'GBP'),
        status: 'planning',
        createdAt: now,
        updatedAt: now,
      });
      await repo.save({
        id: crypto.randomUUID(),
        ownerId: owner2,
        name: 'Trip B',
        totalBudget: money(1_000_000, 'GBP'),
        status: 'planning',
        createdAt: now,
        updatedAt: now,
      });

      const result = await repo.findAllByOwner(owner1);
      expect(result).toHaveLength(1);
      expect(result[0]?.name).toBe('Trip A');
    });

    it('returns multiple trips for the same owner', async () => {
      const { id: ownerId } = await seedUser(db);
      const repo = new DrizzleTripRepository(db);
      const now = new Date();

      await repo.save({
        id: crypto.randomUUID(),
        ownerId,
        name: 'Trip 1',
        totalBudget: money(1_000_000, 'GBP'),
        status: 'planning',
        createdAt: now,
        updatedAt: now,
      });
      await repo.save({
        id: crypto.randomUUID(),
        ownerId,
        name: 'Trip 2',
        totalBudget: money(2_000_000, 'GBP'),
        status: 'planning',
        createdAt: now,
        updatedAt: now,
      });

      const result = await repo.findAllByOwner(ownerId);
      expect(result).toHaveLength(2);
    });
  });

  describe('save', () => {
    it('inserts a new trip and returns it with all fields', async () => {
      const { id: ownerId } = await seedUser(db);
      const repo = new DrizzleTripRepository(db);
      const id = crypto.randomUUID();
      const now = new Date();

      const trip = await repo.save({
        id,
        ownerId,
        name: 'Round the World',
        totalBudget: money(5_000_000, 'GBP'),
        status: 'planning',
        createdAt: now,
        updatedAt: now,
      });

      expect(trip.id).toBe(id);
      expect(trip.name).toBe('Round the World');
      expect(trip.totalBudget.amountPence).toBe(5_000_000);
    });

    it('upserts an existing trip — name and budget are updated', async () => {
      const { id: ownerId } = await seedUser(db);
      const repo = new DrizzleTripRepository(db);
      const now = new Date();

      const original = await repo.save({
        id: crypto.randomUUID(),
        ownerId,
        name: 'Old Name',
        totalBudget: money(1_000_000, 'GBP'),
        status: 'planning',
        createdAt: now,
        updatedAt: now,
      });

      const updated = await repo.save({
        ...original,
        name: 'New Name',
        totalBudget: money(2_000_000, 'GBP'),
        updatedAt: new Date(),
      });

      expect(updated.id).toBe(original.id);
      expect(updated.name).toBe('New Name');
      expect(updated.totalBudget.amountPence).toBe(2_000_000);
    });
  });
});
