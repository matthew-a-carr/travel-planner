import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { DrizzleTripFixedCostRepository } from '@/infrastructure/db/repositories/drizzle-trip-fixed-cost-repository';
import { DrizzleTripRepository } from '@/infrastructure/db/repositories/drizzle-trip-repository';
import {
  type Db,
  type Sql,
  createTestDb,
  seedFixedCost,
  seedTrip,
  seedUser,
  truncateAll,
} from '@/infrastructure/testing/helpers';
import { addFixedCost } from './add-fixed-cost';

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

describe('addFixedCost', () => {
  it('returns err when the trip does not exist', async () => {
    const tripRepo = new DrizzleTripRepository(db);
    const fixedCostRepo = new DrizzleTripFixedCostRepository(db);

    const result = await addFixedCost(tripRepo, fixedCostRepo, {
      tripId: crypto.randomUUID(),
      label: 'Flights',
      amountPence: 95_000,
      currency: 'GBP',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('Trip not found');
  });

  it('saves a valid fixed cost and returns it', async () => {
    const { id: ownerId } = await seedUser(db);
    const trip = await seedTrip(db, ownerId);
    const tripRepo = new DrizzleTripRepository(db);
    const fixedCostRepo = new DrizzleTripFixedCostRepository(db);

    const result = await addFixedCost(tripRepo, fixedCostRepo, {
      tripId: trip.id,
      label: 'Flights to Asia',
      amountPence: 95_000,
      currency: 'GBP',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.tripId).toBe(trip.id);
      expect(result.value.label).toBe('Flights to Asia');
      expect(result.value.amount.amountPence).toBe(95_000);
    }
  });

  it('assigns sortOrder 0 to the first fixed cost', async () => {
    const { id: ownerId } = await seedUser(db);
    const trip = await seedTrip(db, ownerId);
    const tripRepo = new DrizzleTripRepository(db);
    const fixedCostRepo = new DrizzleTripFixedCostRepository(db);

    const result = await addFixedCost(tripRepo, fixedCostRepo, {
      tripId: trip.id,
      label: 'First cost',
      amountPence: 10_000,
      currency: 'GBP',
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.sortOrder).toBe(0);
  });

  it('assigns sortOrder max+1 to subsequent fixed costs', async () => {
    const { id: ownerId } = await seedUser(db);
    const trip = await seedTrip(db, ownerId);
    await seedFixedCost(db, trip.id, { sortOrder: 0 });
    await seedFixedCost(db, trip.id, { sortOrder: 2, label: 'High sort order' });
    const tripRepo = new DrizzleTripRepository(db);
    const fixedCostRepo = new DrizzleTripFixedCostRepository(db);

    const result = await addFixedCost(tripRepo, fixedCostRepo, {
      tripId: trip.id,
      label: 'New cost',
      amountPence: 5_000,
      currency: 'GBP',
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.sortOrder).toBe(3); // max(0,2) + 1 = 3
  });
});
