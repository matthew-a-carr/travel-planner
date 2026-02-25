import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { DrizzleTripFixedCostRepository } from '@/infrastructure/db/repositories/drizzle-trip-fixed-cost-repository';
import {
  createTestDb,
  type Db,
  type Sql,
  seedFixedCost,
  seedTrip,
  seedUser,
  truncateAll,
} from '@/infrastructure/testing/helpers';
import { removeFixedCost } from './remove-fixed-cost';

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

describe('removeFixedCost', () => {
  it('deletes the fixed cost from the database', async () => {
    const { id: ownerId } = await seedUser(db);
    const trip = await seedTrip(db, ownerId);
    const fixedCost = await seedFixedCost(db, trip.id);
    const fixedCostRepo = new DrizzleTripFixedCostRepository(db);

    await removeFixedCost(fixedCostRepo, fixedCost.id);

    const remaining = await fixedCostRepo.findByTrip(trip.id);
    expect(remaining).toHaveLength(0);
  });

  it('excludes the deleted cost from subsequent findByTrip results', async () => {
    const { id: ownerId } = await seedUser(db);
    const trip = await seedTrip(db, ownerId);
    const costToRemove = await seedFixedCost(db, trip.id, { label: 'Flights', sortOrder: 0 });
    await seedFixedCost(db, trip.id, { label: 'Accommodation', sortOrder: 1 });
    const fixedCostRepo = new DrizzleTripFixedCostRepository(db);

    await removeFixedCost(fixedCostRepo, costToRemove.id);

    const remaining = await fixedCostRepo.findByTrip(trip.id);
    expect(remaining).toHaveLength(1);
    expect(remaining[0]?.label).toBe('Accommodation');
  });

  it('is a no-op for a non-existent id', async () => {
    const fixedCostRepo = new DrizzleTripFixedCostRepository(db);

    await expect(removeFixedCost(fixedCostRepo, crypto.randomUUID())).resolves.toBeUndefined();
  });
});
