import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { DrizzleDestinationRepository } from '@/infrastructure/db/repositories/drizzle-destination-repository';
import { DrizzleTripFixedCostRepository } from '@/infrastructure/db/repositories/drizzle-trip-fixed-cost-repository';
import { DrizzleTripRepository } from '@/infrastructure/db/repositories/drizzle-trip-repository';
import {
  createTestDb,
  type Db,
  type Sql,
  seedOrganization,
  seedUser,
  truncateAll,
} from '@/infrastructure/testing/helpers';
import type { BulkDestinationCandidate } from './bulk-add-destinations';
import { createTripWithDestinations } from './create-trip-with-destinations';

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

describe('createTripWithDestinations', () => {
  it('creates the trip and saves all valid destinations', async () => {
    const { id: ownerId } = await seedUser(db);
    const { id: organizationId } = await seedOrganization(db, ownerId);
    const { tripRepo, destRepo, fixedCostRepo } = repos(db);

    const result = await createTripWithDestinations(tripRepo, destRepo, fixedCostRepo, {
      organizationId,
      ownerId,
      name: 'Vietnam → Cambodia',
      totalBudgetPence: 1_000_000,
      currency: 'GBP',
      candidates: [
        baseRow,
        { ...baseRow, name: 'Phnom Penh', country: 'Cambodia', city: 'Phnom Penh' },
      ],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.trip.name).toBe('Vietnam → Cambodia');
    expect(result.savedDestinations).toHaveLength(2);
    const persisted = await destRepo.findByTrip(result.trip.id);
    expect(persisted).toHaveLength(2);
  });

  it('returns ok with no destinations when the candidate list is empty', async () => {
    const { id: ownerId } = await seedUser(db);
    const { id: organizationId } = await seedOrganization(db, ownerId);
    const { tripRepo, destRepo, fixedCostRepo } = repos(db);

    const result = await createTripWithDestinations(tripRepo, destRepo, fixedCostRepo, {
      organizationId,
      ownerId,
      name: 'Plan TBD',
      totalBudgetPence: 500_000,
      currency: 'GBP',
      candidates: [],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.savedDestinations).toEqual([]);
    const found = await tripRepo.findById(result.trip.id);
    expect(found?.name).toBe('Plan TBD');
  });

  it('rolls back the trip when bulk-add fails on a budget invariant', async () => {
    const { id: ownerId } = await seedUser(db);
    const { id: organizationId } = await seedOrganization(db, ownerId);
    const { tripRepo, destRepo, fixedCostRepo } = repos(db);

    // Budget is £50; first destination eats £40, second wants £40 — breaches cap.
    const result = await createTripWithDestinations(tripRepo, destRepo, fixedCostRepo, {
      organizationId,
      ownerId,
      name: 'Doomed',
      totalBudgetPence: 5_000,
      currency: 'GBP',
      candidates: [
        { ...baseRow, estimatedBudgetPence: 4_000 },
        { ...baseRow, estimatedBudgetPence: 4_000, name: 'Saigon', city: 'Saigon' },
      ],
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('rolled back');
    expect(result.bulkErrors).toBeDefined();

    // Trip must be gone — compensation removed it.
    const trips = await tripRepo.findAllByOrganization(organizationId);
    expect(trips).toEqual([]);
  });

  it('returns err when the trip budget is invalid (no destination work attempted)', async () => {
    const { id: ownerId } = await seedUser(db);
    const { id: organizationId } = await seedOrganization(db, ownerId);
    const { tripRepo, destRepo, fixedCostRepo } = repos(db);

    const result = await createTripWithDestinations(tripRepo, destRepo, fixedCostRepo, {
      organizationId,
      ownerId,
      name: 'Bad budget',
      totalBudgetPence: -1,
      currency: 'GBP',
      candidates: [baseRow],
    });

    expect(result.ok).toBe(false);
    const trips = await tripRepo.findAllByOrganization(organizationId);
    expect(trips).toEqual([]);
  });
});
