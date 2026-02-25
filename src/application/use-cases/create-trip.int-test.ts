import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { DrizzleTripRepository } from '@/infrastructure/db/repositories/drizzle-trip-repository';
import {
  createTestDb,
  type Db,
  type Sql,
  seedUser,
  truncateAll,
} from '@/infrastructure/testing/helpers';
import { createTrip } from './create-trip';

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

describe('createTrip', () => {
  it('creates a trip with status planning', async () => {
    const { id: ownerId } = await seedUser(db);
    const repo = new DrizzleTripRepository(db);

    const trip = await createTrip(repo, {
      ownerId,
      name: 'Round the World',
      totalBudgetPence: 5_000_000,
      currency: 'GBP',
    });

    expect(trip.status).toBe('planning');
  });

  it('persists the trip and returns it with a generated id', async () => {
    const { id: ownerId } = await seedUser(db);
    const repo = new DrizzleTripRepository(db);

    const trip = await createTrip(repo, {
      ownerId,
      name: 'Asia Tour',
      totalBudgetPence: 3_000_000,
      currency: 'GBP',
    });

    expect(trip.id).toBeTruthy();
    expect(trip.name).toBe('Asia Tour');
    expect(trip.totalBudget.amountPence).toBe(3_000_000);
    expect(trip.totalBudget.currency).toBe('GBP');
    expect(trip.ownerId).toBe(ownerId);
  });

  it('is readable by findById after creation', async () => {
    const { id: ownerId } = await seedUser(db);
    const repo = new DrizzleTripRepository(db);

    const trip = await createTrip(repo, {
      ownerId,
      name: 'Persisted Trip',
      totalBudgetPence: 1_000_000,
      currency: 'GBP',
    });

    const found = await repo.findById(trip.id);
    expect(found?.name).toBe('Persisted Trip');
  });
});
