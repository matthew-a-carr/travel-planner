import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { money } from '../../../domain/trip/types';
import {
  createTestDb,
  type Db,
  type Sql,
  seedDestination,
  seedFixedCost,
  seedOrganization,
  seedSpendEntry,
  seedTrip,
  seedUser,
  truncateAll,
} from '../../../infrastructure/testing/helpers';
import { DrizzleDestinationRepository } from './drizzle-destination-repository';
import { DrizzleSpendEntryRepository } from './drizzle-spend-entry-repository';
import { DrizzleTripFixedCostRepository } from './drizzle-trip-fixed-cost-repository';
import { DrizzleTripRepository } from './drizzle-trip-repository';

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
      const { id: organizationId } = await seedOrganization(db, ownerId);
      const now = new Date();
      const repo = new DrizzleTripRepository(db);
      const saved = await repo.save({
        id: crypto.randomUUID(),
        organizationId,
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
      expect(found?.organizationId).toBe(organizationId);
      expect(found?.ownerId).toBe(ownerId);
    });
  });

  describe('findAllByOrganization', () => {
    it('returns an empty array when the organization has no trips', async () => {
      const { id: ownerId } = await seedUser(db);
      const { id: organizationId } = await seedOrganization(db, ownerId);
      const repo = new DrizzleTripRepository(db);
      const result = await repo.findAllByOrganization(organizationId);
      expect(result).toEqual([]);
    });

    it('returns only trips belonging to the given organization', async () => {
      const { id: owner1 } = await seedUser(db);
      const { id: owner2 } = await seedUser(db);
      const { id: organization1 } = await seedOrganization(db, owner1);
      const { id: organization2 } = await seedOrganization(db, owner2);
      const repo = new DrizzleTripRepository(db);
      const now = new Date();

      await repo.save({
        id: crypto.randomUUID(),
        organizationId: organization1,
        ownerId: owner1,
        name: 'Trip A',
        totalBudget: money(1_000_000, 'GBP'),
        status: 'planning',
        createdAt: now,
        updatedAt: now,
      });
      await repo.save({
        id: crypto.randomUUID(),
        organizationId: organization2,
        ownerId: owner2,
        name: 'Trip B',
        totalBudget: money(1_000_000, 'GBP'),
        status: 'planning',
        createdAt: now,
        updatedAt: now,
      });

      const result = await repo.findAllByOrganization(organization1);
      expect(result).toHaveLength(1);
      expect(result[0]?.name).toBe('Trip A');
    });

    it('returns multiple trips for the same organization', async () => {
      const { id: ownerId } = await seedUser(db);
      const { id: organizationId } = await seedOrganization(db, ownerId);
      const repo = new DrizzleTripRepository(db);
      const now = new Date();

      await repo.save({
        id: crypto.randomUUID(),
        organizationId,
        ownerId,
        name: 'Trip 1',
        totalBudget: money(1_000_000, 'GBP'),
        status: 'planning',
        createdAt: now,
        updatedAt: now,
      });
      await repo.save({
        id: crypto.randomUUID(),
        organizationId,
        ownerId,
        name: 'Trip 2',
        totalBudget: money(2_000_000, 'GBP'),
        status: 'planning',
        createdAt: now,
        updatedAt: now,
      });

      const result = await repo.findAllByOrganization(organizationId);
      expect(result).toHaveLength(2);
    });
  });

  describe('save', () => {
    it('inserts a new trip and returns it with all fields', async () => {
      const { id: ownerId } = await seedUser(db);
      const { id: organizationId } = await seedOrganization(db, ownerId);
      const repo = new DrizzleTripRepository(db);
      const id = crypto.randomUUID();
      const now = new Date();

      const trip = await repo.save({
        id,
        organizationId,
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
      const { id: organizationId } = await seedOrganization(db, ownerId);
      const repo = new DrizzleTripRepository(db);
      const now = new Date();

      const original = await repo.save({
        id: crypto.randomUUID(),
        organizationId,
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

  describe('delete', () => {
    it('deletes an existing trip', async () => {
      const { id: ownerId } = await seedUser(db);
      const trip = await seedTrip(db, ownerId);
      const repo = new DrizzleTripRepository(db);

      await repo.delete(trip.id);

      expect(await repo.findById(trip.id)).toBeNull();
    });

    it('is a no-op for a non-existent id', async () => {
      const repo = new DrizzleTripRepository(db);
      await expect(repo.delete(crypto.randomUUID())).resolves.toBeUndefined();
    });

    it('cascades delete to fixed costs, destinations, and spend entries', async () => {
      const { id: ownerId } = await seedUser(db);
      const trip = await seedTrip(db, ownerId);
      const destination = await seedDestination(db, trip.id);
      await seedFixedCost(db, trip.id);
      await seedSpendEntry(db, destination.id);

      const tripRepo = new DrizzleTripRepository(db);
      const destinationRepo = new DrizzleDestinationRepository(db);
      const spendRepo = new DrizzleSpendEntryRepository(db);
      const fixedCostRepo = new DrizzleTripFixedCostRepository(db);

      await tripRepo.delete(trip.id);

      expect(await tripRepo.findById(trip.id)).toBeNull();
      expect(await fixedCostRepo.findByTrip(trip.id)).toEqual([]);
      expect(await destinationRepo.findByTrip(trip.id)).toEqual([]);
      expect(await spendRepo.findByTrip(trip.id)).toEqual([]);
    });
  });
});
