import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { DrizzleDestinationRepository } from '@/infrastructure/db/repositories/drizzle-destination-repository';
import { DrizzleTripFixedCostRepository } from '@/infrastructure/db/repositories/drizzle-trip-fixed-cost-repository';
import { DrizzleTripRepository } from '@/infrastructure/db/repositories/drizzle-trip-repository';
import {
  type Db,
  type Sql,
  createTestDb,
  seedDestination,
  seedFixedCost,
  seedTrip,
  seedUser,
  truncateAll,
} from '@/infrastructure/testing/helpers';
import { addDestination } from './add-destination';

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

const baseInput = {
  name: 'Japan',
  country: 'Japan',
  estimatedBudgetPence: 1_000_000,
  currency: 'GBP' as const,
  comfortLevel: 'mid' as const,
  startDate: null,
  endDate: null,
};

describe('addDestination', () => {
  it('returns err when the trip does not exist', async () => {
    const { tripRepo, destRepo, fixedCostRepo } = repos(db);
    const result = await addDestination(tripRepo, destRepo, fixedCostRepo, {
      tripId: crypto.randomUUID(),
      ...baseInput,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('Trip not found');
  });

  it('returns err when the allocation would exceed the trip budget', async () => {
    const { id: ownerId } = await seedUser(db);
    const trip = await seedTrip(db, ownerId, { totalBudgetPence: 500_000 }); // £5,000
    const { tripRepo, destRepo, fixedCostRepo } = repos(db);

    const result = await addDestination(tripRepo, destRepo, fixedCostRepo, {
      tripId: trip.id,
      ...baseInput,
      estimatedBudgetPence: 500_001, // over by 1p
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('exceeds available budget');
  });

  it('returns err when the date range is invalid', async () => {
    const { id: ownerId } = await seedUser(db);
    const trip = await seedTrip(db, ownerId);
    const { tripRepo, destRepo, fixedCostRepo } = repos(db);

    const result = await addDestination(tripRepo, destRepo, fixedCostRepo, {
      tripId: trip.id,
      ...baseInput,
      startDate: new Date('2026-07-01'),
      endDate: new Date('2026-06-01'), // end before start
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('Start date must be before end date');
  });

  it('saves a valid destination and returns it', async () => {
    const { id: ownerId } = await seedUser(db);
    const trip = await seedTrip(db, ownerId);
    const { tripRepo, destRepo, fixedCostRepo } = repos(db);

    const result = await addDestination(tripRepo, destRepo, fixedCostRepo, {
      tripId: trip.id,
      ...baseInput,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.tripId).toBe(trip.id);
      expect(result.value.name).toBe('Japan');
      expect(result.value.estimatedBudget.amountPence).toBe(1_000_000);
    }
  });

  it('assigns sortOrder 0 to the first destination', async () => {
    const { id: ownerId } = await seedUser(db);
    const trip = await seedTrip(db, ownerId);
    const { tripRepo, destRepo, fixedCostRepo } = repos(db);

    const result = await addDestination(tripRepo, destRepo, fixedCostRepo, {
      tripId: trip.id,
      ...baseInput,
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.sortOrder).toBe(0);
  });

  it('assigns sortOrder max+1 to subsequent destinations', async () => {
    const { id: ownerId } = await seedUser(db);
    const trip = await seedTrip(db, ownerId);
    await seedDestination(db, trip.id, { sortOrder: 0, estimatedBudgetPence: 500_000 });
    const { tripRepo, destRepo, fixedCostRepo } = repos(db);

    const result = await addDestination(tripRepo, destRepo, fixedCostRepo, {
      tripId: trip.id,
      ...baseInput,
      estimatedBudgetPence: 500_000,
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.sortOrder).toBe(1);
  });

  it('accounts for fixed costs when checking budget', async () => {
    const { id: ownerId } = await seedUser(db);
    // Budget £10k; fixed cost £8k → available £2k
    const trip = await seedTrip(db, ownerId, { totalBudgetPence: 1_000_000 });
    await seedFixedCost(db, trip.id, { amountPence: 800_000 });
    const { tripRepo, destRepo, fixedCostRepo } = repos(db);

    const result = await addDestination(tripRepo, destRepo, fixedCostRepo, {
      tripId: trip.id,
      ...baseInput,
      estimatedBudgetPence: 200_001, // over by 1p
    });

    expect(result.ok).toBe(false);
  });
});
