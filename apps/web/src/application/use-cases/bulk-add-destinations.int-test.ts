import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { DrizzleDestinationRepository } from '@/infrastructure/db/repositories/drizzle-destination-repository';
import { DrizzleTripFixedCostRepository } from '@/infrastructure/db/repositories/drizzle-trip-fixed-cost-repository';
import { DrizzleTripRepository } from '@/infrastructure/db/repositories/drizzle-trip-repository';
import {
  createTestDb,
  type Db,
  type Sql,
  seedTrip,
  seedUser,
  truncateAll,
} from '@/infrastructure/testing/helpers';
import { type BulkDestinationCandidate, bulkAddDestinations } from './bulk-add-destinations';

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

const baseRow: BulkDestinationCandidate = {
  name: 'Hanoi',
  country: 'Vietnam',
  city: 'Hanoi',
  latitude: null,
  longitude: null,
  estimatedBudgetPence: 200_000,
  currency: 'GBP',
  comfortLevel: 'mid',
  startDate: null,
  endDate: null,
};

describe('bulkAddDestinations', () => {
  it('returns ok with no saves when given an empty list', async () => {
    const { tripRepo, destRepo, fixedCostRepo } = repos(db);
    const result = await bulkAddDestinations(
      tripRepo,
      destRepo,
      fixedCostRepo,
      crypto.randomUUID(),
      [],
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.saved).toEqual([]);
  });

  it('returns errors for an unknown trip', async () => {
    const { tripRepo, destRepo, fixedCostRepo } = repos(db);
    const result = await bulkAddDestinations(
      tripRepo,
      destRepo,
      fixedCostRepo,
      crypto.randomUUID(),
      [baseRow],
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0].error).toContain('Trip not found');
  });

  it('saves multiple destinations in a single call with sequential sortOrder', async () => {
    const { id: ownerId } = await seedUser(db);
    const trip = await seedTrip(db, ownerId, { totalBudgetPence: 1_000_000 });
    const { tripRepo, destRepo, fixedCostRepo } = repos(db);

    const rows: BulkDestinationCandidate[] = [
      { ...baseRow, name: 'Hanoi', estimatedBudgetPence: 200_000 },
      { ...baseRow, name: 'Saigon', estimatedBudgetPence: 200_000 },
      { ...baseRow, name: 'Phnom Penh', country: 'Cambodia', estimatedBudgetPence: 200_000 },
    ];

    const result = await bulkAddDestinations(tripRepo, destRepo, fixedCostRepo, trip.id, rows);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.saved).toHaveLength(3);
      const sortOrders = result.saved.map((d) => d.sortOrder).sort();
      expect(sortOrders).toEqual([0, 1, 2]);
    }

    const persisted = await destRepo.findByTrip(trip.id);
    expect(persisted).toHaveLength(3);
  });

  it('rejects the whole batch and saves nothing when cumulative budget would be exceeded', async () => {
    const { id: ownerId } = await seedUser(db);
    const trip = await seedTrip(db, ownerId, { totalBudgetPence: 500_000 }); // £5,000
    const { tripRepo, destRepo, fixedCostRepo } = repos(db);

    const rows: BulkDestinationCandidate[] = [
      { ...baseRow, name: 'A', estimatedBudgetPence: 300_000 },
      { ...baseRow, name: 'B', estimatedBudgetPence: 300_000 }, // cumulative 600k > 500k
    ];

    const result = await bulkAddDestinations(tripRepo, destRepo, fixedCostRepo, trip.id, rows);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].index).toBe(1);
    }

    const persisted = await destRepo.findByTrip(trip.id);
    expect(persisted).toEqual([]);
  });

  it('rejects rows with invalid date ranges', async () => {
    const { id: ownerId } = await seedUser(db);
    const trip = await seedTrip(db, ownerId);
    const { tripRepo, destRepo, fixedCostRepo } = repos(db);

    const result = await bulkAddDestinations(tripRepo, destRepo, fixedCostRepo, trip.id, [
      {
        ...baseRow,
        startDate: new Date('2026-08-10'),
        endDate: new Date('2026-08-01'),
      },
    ]);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0].error).toContain('Start date must be before end date');
  });
});
