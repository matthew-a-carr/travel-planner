import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { DrizzleDestinationRepository } from '@/infrastructure/db/repositories/drizzle-destination-repository';
import { DrizzleTripFixedCostRepository } from '@/infrastructure/db/repositories/drizzle-trip-fixed-cost-repository';
import { DrizzleTripRepository } from '@/infrastructure/db/repositories/drizzle-trip-repository';
import {
  type Db,
  type Sql,
  createTestDb,
  seedDestination,
  seedTrip,
  seedUser,
  truncateAll,
} from '@/infrastructure/testing/helpers';
import { editDestination } from './edit-destination';

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

describe('editDestination', () => {
  it('returns err when the destination does not exist', async () => {
    const { id: ownerId } = await seedUser(db);
    const trip = await seedTrip(db, ownerId);
    const { tripRepo, destRepo, fixedCostRepo } = repos(db);

    const result = await editDestination(tripRepo, destRepo, fixedCostRepo, {
      destinationId: crypto.randomUUID(),
      tripId: trip.id,
      name: 'Japan',
      country: 'Japan',
      estimatedBudgetPence: 1_000_000,
      currency: 'GBP',
      comfortLevel: 'mid',
      startDate: null,
      endDate: null,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('not found');
  });

  it('returns err when destination does not belong to the given trip', async () => {
    const { id: ownerId } = await seedUser(db);
    const trip1 = await seedTrip(db, ownerId);
    const trip2 = await seedTrip(db, ownerId);
    const dest = await seedDestination(db, trip1.id);
    const { tripRepo, destRepo, fixedCostRepo } = repos(db);

    const result = await editDestination(tripRepo, destRepo, fixedCostRepo, {
      destinationId: dest.id,
      tripId: trip2.id, // wrong trip
      name: 'Updated',
      country: 'Japan',
      estimatedBudgetPence: 1_000_000,
      currency: 'GBP',
      comfortLevel: 'mid',
      startDate: null,
      endDate: null,
    });

    expect(result.ok).toBe(false);
  });

  it('persists updated name and country', async () => {
    const { id: ownerId } = await seedUser(db);
    const trip = await seedTrip(db, ownerId);
    const dest = await seedDestination(db, trip.id, { name: 'Old Name', country: 'Japan' });
    const { tripRepo, destRepo, fixedCostRepo } = repos(db);

    const result = await editDestination(tripRepo, destRepo, fixedCostRepo, {
      destinationId: dest.id,
      tripId: trip.id,
      name: 'New Name',
      country: 'South Korea',
      estimatedBudgetPence: dest.estimatedBudget.amountPence,
      currency: 'GBP',
      comfortLevel: 'mid',
      startDate: null,
      endDate: null,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.name).toBe('New Name');
      expect(result.value.country).toBe('South Korea');
    }
  });

  it('returns err when budget increase exceeds available headroom', async () => {
    const { id: ownerId } = await seedUser(db);
    // Total £10k; dest at £8k; available = £2k
    const trip = await seedTrip(db, ownerId, { totalBudgetPence: 1_000_000 });
    const dest = await seedDestination(db, trip.id, { estimatedBudgetPence: 800_000 });
    const { tripRepo, destRepo, fixedCostRepo } = repos(db);

    // Try to increase to £10k + 1p — delta = 200_001p > available 200_000p
    const result = await editDestination(tripRepo, destRepo, fixedCostRepo, {
      destinationId: dest.id,
      tripId: trip.id,
      name: dest.name,
      country: dest.country,
      estimatedBudgetPence: 1_000_001,
      currency: 'GBP',
      comfortLevel: 'mid',
      startDate: null,
      endDate: null,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('exceeds available budget');
  });

  it('allows a budget decrease even if trip is over-allocated', async () => {
    const { id: ownerId } = await seedUser(db);
    const trip = await seedTrip(db, ownerId, { totalBudgetPence: 500_000 });
    const dest = await seedDestination(db, trip.id, { estimatedBudgetPence: 600_000 }); // over budget already
    const { tripRepo, destRepo, fixedCostRepo } = repos(db);

    const result = await editDestination(tripRepo, destRepo, fixedCostRepo, {
      destinationId: dest.id,
      tripId: trip.id,
      name: dest.name,
      country: dest.country,
      estimatedBudgetPence: 400_000, // decrease is always allowed
      currency: 'GBP',
      comfortLevel: 'mid',
      startDate: null,
      endDate: null,
    });

    expect(result.ok).toBe(true);
  });
});
