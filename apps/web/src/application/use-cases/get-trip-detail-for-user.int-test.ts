import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { DrizzleDestinationRepository } from '../../infrastructure/db/repositories/drizzle-destination-repository';
import { DrizzleOrganizationRepository } from '../../infrastructure/db/repositories/drizzle-organization-repository';
import { DrizzleSpendEntryRepository } from '../../infrastructure/db/repositories/drizzle-spend-entry-repository';
import { DrizzleTripFixedCostRepository } from '../../infrastructure/db/repositories/drizzle-trip-fixed-cost-repository';
import { DrizzleTripRepository } from '../../infrastructure/db/repositories/drizzle-trip-repository';
import {
  createTestDb,
  type Db,
  type Sql,
  seedDestination,
  seedFixedCost,
  seedOrganization,
  seedOrganizationMember,
  seedSpendEntry,
  seedTrip,
  seedUser,
  truncateAll,
} from '../../infrastructure/testing/helpers';
import { getTripDetailForUser } from './get-trip-detail-for-user';

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

async function run(userId: string, tripId: string) {
  return getTripDetailForUser(
    new DrizzleOrganizationRepository(db),
    new DrizzleTripRepository(db),
    new DrizzleDestinationRepository(db),
    new DrizzleTripFixedCostRepository(db),
    new DrizzleSpendEntryRepository(db),
    userId,
    tripId,
  );
}

describe('getTripDetailForUser', () => {
  it('returns null for an unknown trip id', async () => {
    const { id: userId } = await seedUser(db);
    expect(await run(userId, crypto.randomUUID())).toBeNull();
  });

  it('returns null when the caller is not a member of the trip organisation', async () => {
    const { id: owner } = await seedUser(db);
    const org = await seedOrganization(db, owner);
    const trip = await seedTrip(db, owner, { organizationId: org.id });

    const { id: outsider } = await seedUser(db);

    expect(await run(outsider, trip.id)).toBeNull();
  });

  it('returns the detail for a non-owner member of the organisation', async () => {
    const { id: owner } = await seedUser(db);
    const org = await seedOrganization(db, owner);
    const trip = await seedTrip(db, owner, { organizationId: org.id });
    const { id: member } = await seedUser(db);
    await seedOrganizationMember(db, org.id, member, 'member');

    const detail = await run(member, trip.id);

    expect(detail?.id).toBe(trip.id);
  });

  it('maps trip fields, destinations (web ordering), and fixed costs onto the wire shape', async () => {
    const { id: userId } = await seedUser(db);
    const org = await seedOrganization(db, userId);
    const trip = await seedTrip(db, userId, {
      organizationId: org.id,
      name: 'Japan 2026',
      totalBudgetPence: 500_000,
    });
    const later = await seedDestination(db, trip.id, {
      name: 'Kyoto',
      city: 'Kyoto',
      startDate: new Date('2026-09-10'),
      endDate: new Date('2026-09-21'),
      estimatedBudgetPence: 100_000,
      comfortLevel: 'budget',
      sortOrder: 1,
    });
    const earlier = await seedDestination(db, trip.id, {
      name: 'Tokyo',
      startDate: new Date('2026-09-01'),
      endDate: new Date('2026-09-09'),
      estimatedBudgetPence: 250_000,
      comfortLevel: 'mid',
      sortOrder: 0,
    });
    const flight = await seedFixedCost(db, trip.id, {
      label: 'Flights',
      amountPence: 120_000,
      category: 'transport',
      date: new Date('2026-08-15'),
    });

    const detail = await run(userId, trip.id);

    expect(detail).toMatchObject({
      id: trip.id,
      name: 'Japan 2026',
      status: 'planning',
      totalBudget: { amountPence: 500_000, currency: 'GBP' },
      startDate: '2026-09-01',
      endDate: '2026-09-21',
      organizationId: org.id,
    });
    expect(detail?.destinations.map((d) => d.id)).toEqual([earlier.id, later.id]);
    expect(detail?.destinations[0]).toMatchObject({
      name: 'Tokyo',
      country: 'Japan',
      startDate: '2026-09-01',
      endDate: '2026-09-09',
      estimatedBudget: { amountPence: 250_000, currency: 'GBP' },
      comfortLevel: 'mid',
      sortOrder: 0,
    });
    expect(detail?.fixedCosts).toEqual([
      {
        id: flight.id,
        label: 'Flights',
        amount: { amountPence: 120_000, currency: 'GBP' },
        category: 'transport',
        date: '2026-08-15',
        sortOrder: 0,
      },
    ]);
  });

  it('computes the spend summary consistently with the web domain functions (criterion 5)', async () => {
    const { id: userId } = await seedUser(db);
    const org = await seedOrganization(db, userId);
    const trip = await seedTrip(db, userId, {
      organizationId: org.id,
      totalBudgetPence: 500_000,
    });
    const tokyo = await seedDestination(db, trip.id, { estimatedBudgetPence: 250_000 });
    const kyoto = await seedDestination(db, trip.id, {
      estimatedBudgetPence: 100_000,
      sortOrder: 1,
    });
    await seedFixedCost(db, trip.id, { amountPence: 120_000 });
    await seedSpendEntry(db, tokyo.id, { amountPence: 5_000 });
    await seedSpendEntry(db, tokyo.id, { amountPence: 7_345 });
    await seedSpendEntry(db, kyoto.id, { amountPence: 1_000 });

    const detail = await run(userId, trip.id);

    expect(detail?.spend).toEqual({
      totalBudget: { amountPence: 500_000, currency: 'GBP' },
      fixedCosts: { amountPence: 120_000, currency: 'GBP' },
      allocated: { amountPence: 350_000, currency: 'GBP' },
      available: { amountPence: 30_000, currency: 'GBP' },
      spent: { amountPence: 13_345, currency: 'GBP' },
      isOverAllocated: false,
    });
    const tokyoLeg = detail?.destinations.find((d) => d.id === tokyo.id);
    const kyotoLeg = detail?.destinations.find((d) => d.id === kyoto.id);
    expect(tokyoLeg?.spent).toEqual({ amountPence: 12_345, currency: 'GBP' });
    expect(kyotoLeg?.spent).toEqual({ amountPence: 1_000, currency: 'GBP' });
  });

  it('flags over-allocation and returns a negative available amount', async () => {
    const { id: userId } = await seedUser(db);
    const org = await seedOrganization(db, userId);
    const trip = await seedTrip(db, userId, {
      organizationId: org.id,
      totalBudgetPence: 100_000,
    });
    await seedDestination(db, trip.id, { estimatedBudgetPence: 150_000 });

    const detail = await run(userId, trip.id);

    expect(detail?.spend.isOverAllocated).toBe(true);
    expect(detail?.spend.available).toEqual({ amountPence: -50_000, currency: 'GBP' });
  });

  it('returns zeroed spend and empty collections for a bare trip', async () => {
    const { id: userId } = await seedUser(db);
    const org = await seedOrganization(db, userId);
    const trip = await seedTrip(db, userId, { organizationId: org.id });

    const detail = await run(userId, trip.id);

    expect(detail?.destinations).toEqual([]);
    expect(detail?.fixedCosts).toEqual([]);
    expect(detail?.startDate).toBeNull();
    expect(detail?.endDate).toBeNull();
    expect(detail?.spend.spent).toEqual({ amountPence: 0, currency: 'GBP' });
    expect(detail?.spend.fixedCosts).toEqual({ amountPence: 0, currency: 'GBP' });
  });
});
