import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { DrizzleDestinationRepository } from '@/infrastructure/db/repositories/drizzle-destination-repository';
import { DrizzleTripFixedCostRepository } from '@/infrastructure/db/repositories/drizzle-trip-fixed-cost-repository';
import { DrizzleTripRepository } from '@/infrastructure/db/repositories/drizzle-trip-repository';
import {
  createTestDb,
  type Db,
  type Sql,
  seedDestination,
  seedFixedCost,
  seedTrip,
  seedUser,
  truncateAll,
} from '@/infrastructure/testing/helpers';
import { editTrip } from './edit-trip';

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

function repos(db: Db) {
  return {
    tripRepo: new DrizzleTripRepository(db),
    destRepo: new DrizzleDestinationRepository(db),
    fixedCostRepo: new DrizzleTripFixedCostRepository(db),
  };
}

describe('editTrip', () => {
  it('returns err when the trip does not exist', async () => {
    const { tripRepo, destRepo, fixedCostRepo } = repos(db);

    const result = await editTrip(tripRepo, destRepo, fixedCostRepo, {
      tripId: crypto.randomUUID(),
      name: 'Ghost Trip',
      totalBudgetPence: 1_000_000,
      currency: 'GBP',
      status: 'planning',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('not found');
  });

  it('persists updated name and returns it via findById', async () => {
    const { id: ownerId } = await seedUser(db);
    const trip = await seedTrip(db, ownerId, { name: 'Old Name' });
    const { tripRepo, destRepo, fixedCostRepo } = repos(db);

    const result = await editTrip(tripRepo, destRepo, fixedCostRepo, {
      tripId: trip.id,
      name: 'New Name',
      totalBudgetPence: trip.totalBudget.amountPence,
      currency: 'GBP',
      status: trip.status,
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.name).toBe('New Name');

    const found = await tripRepo.findById(trip.id);
    expect(found?.name).toBe('New Name');
  });

  it('persists updated budget', async () => {
    const { id: ownerId } = await seedUser(db);
    const trip = await seedTrip(db, ownerId, { totalBudgetPence: 5_000_000 });
    const { tripRepo, destRepo, fixedCostRepo } = repos(db);

    const result = await editTrip(tripRepo, destRepo, fixedCostRepo, {
      tripId: trip.id,
      name: trip.name,
      totalBudgetPence: 6_000_000,
      currency: 'GBP',
      status: trip.status,
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.totalBudget.amountPence).toBe(6_000_000);

    const found = await tripRepo.findById(trip.id);
    expect(found?.totalBudget.amountPence).toBe(6_000_000);
  });

  it('persists updated status', async () => {
    const { id: ownerId } = await seedUser(db);
    const trip = await seedTrip(db, ownerId, { status: 'planning' });
    const { tripRepo, destRepo, fixedCostRepo } = repos(db);

    const result = await editTrip(tripRepo, destRepo, fixedCostRepo, {
      tripId: trip.id,
      name: trip.name,
      totalBudgetPence: trip.totalBudget.amountPence,
      currency: 'GBP',
      status: 'active',
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.status).toBe('active');

    const found = await tripRepo.findById(trip.id);
    expect(found?.status).toBe('active');
  });

  it('returns err when new budget is below existing destination allocations', async () => {
    const { id: ownerId } = await seedUser(db);
    // £50,000 trip with a £30,000 destination
    const trip = await seedTrip(db, ownerId, { totalBudgetPence: 5_000_000 });
    await seedDestination(db, trip.id, { estimatedBudgetPence: 3_000_000 });
    const { tripRepo, destRepo, fixedCostRepo } = repos(db);

    // Try to reduce budget to £20,000 — less than the £30,000 destination
    const result = await editTrip(tripRepo, destRepo, fixedCostRepo, {
      tripId: trip.id,
      name: trip.name,
      totalBudgetPence: 2_000_000,
      currency: 'GBP',
      status: trip.status,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/too small|reduce fixed costs/i);
  });

  it('returns err when new budget is below sum of fixed costs and destinations', async () => {
    const { id: ownerId } = await seedUser(db);
    const trip = await seedTrip(db, ownerId, { totalBudgetPence: 5_000_000 });
    await seedDestination(db, trip.id, { estimatedBudgetPence: 1_000_000 });
    await seedFixedCost(db, trip.id, { amountPence: 1_600_000 });
    const { tripRepo, destRepo, fixedCostRepo } = repos(db);

    // Required = £26,000; try to set budget to £25,000
    const result = await editTrip(tripRepo, destRepo, fixedCostRepo, {
      tripId: trip.id,
      name: trip.name,
      totalBudgetPence: 2_500_000,
      currency: 'GBP',
      status: trip.status,
    });

    expect(result.ok).toBe(false);
  });

  it('allows budget reduction to exact sum of existing allocations', async () => {
    const { id: ownerId } = await seedUser(db);
    const trip = await seedTrip(db, ownerId, { totalBudgetPence: 5_000_000 });
    await seedDestination(db, trip.id, { estimatedBudgetPence: 1_000_000 });
    await seedFixedCost(db, trip.id, { amountPence: 600_000 });
    const { tripRepo, destRepo, fixedCostRepo } = repos(db);

    // Exactly £16,000 — matches total commitments
    const result = await editTrip(tripRepo, destRepo, fixedCostRepo, {
      tripId: trip.id,
      name: trip.name,
      totalBudgetPence: 1_600_000,
      currency: 'GBP',
      status: trip.status,
    });

    expect(result.ok).toBe(true);
  });
});
