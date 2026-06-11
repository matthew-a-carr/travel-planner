import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { DrizzleDestinationRepository } from '../../infrastructure/db/repositories/drizzle-destination-repository';
import { DrizzleOrganizationRepository } from '../../infrastructure/db/repositories/drizzle-organization-repository';
import { DrizzleTripRepository } from '../../infrastructure/db/repositories/drizzle-trip-repository';
import {
  createTestDb,
  type Db,
  type Sql,
  seedDestination,
  seedOrganization,
  seedOrganizationMember,
  seedTrip,
  seedUser,
  truncateAll,
} from '../../infrastructure/testing/helpers';
import { listTripsForUser } from './list-trips-for-user';

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

function repos(database: Db) {
  return {
    organizationRepository: new DrizzleOrganizationRepository(database),
    tripRepository: new DrizzleTripRepository(database),
    destinationRepository: new DrizzleDestinationRepository(database),
  };
}

async function run(userId: string) {
  const { organizationRepository, tripRepository, destinationRepository } = repos(db);
  return listTripsForUser(organizationRepository, tripRepository, destinationRepository, userId);
}

describe('listTripsForUser', () => {
  it('returns the trips in every organisation the user belongs to', async () => {
    const { id: userId } = await seedUser(db);
    const orgA = await seedOrganization(db, userId, { name: 'Org A' });
    const tripA = await seedTrip(db, userId, { organizationId: orgA.id, name: 'Japan 2026' });

    const { id: otherOwner } = await seedUser(db);
    const orgB = await seedOrganization(db, otherOwner, { name: 'Org B' });
    await seedOrganizationMember(db, orgB.id, userId, 'member');
    const tripB = await seedTrip(db, otherOwner, { organizationId: orgB.id, name: 'Lisbon' });

    const summaries = await run(userId);

    expect(summaries.map((s) => s.id).sort()).toEqual([tripA.id, tripB.id].sort());
  });

  it('does not leak trips from organisations the user is not a member of (org-scoped visibility)', async () => {
    const { id: alice } = await seedUser(db);
    const aliceOrg = await seedOrganization(db, alice);
    const aliceTrip = await seedTrip(db, alice, { organizationId: aliceOrg.id });

    const { id: bob } = await seedUser(db);
    const bobOrg = await seedOrganization(db, bob);
    const bobTrip = await seedTrip(db, bob, { organizationId: bobOrg.id });

    const aliceSummaries = await run(alice);
    const bobSummaries = await run(bob);

    expect(aliceSummaries.map((s) => s.id)).toEqual([aliceTrip.id]);
    expect(bobSummaries.map((s) => s.id)).toEqual([bobTrip.id]);
  });

  it('returns an empty list for a user with no organisations', async () => {
    const { id: loner } = await seedUser(db);
    expect(await run(loner)).toEqual([]);
  });

  it('derives startDate as the earliest destination startDate and endDate as the latest destination endDate', async () => {
    const { id: userId } = await seedUser(db);
    const org = await seedOrganization(db, userId);
    const trip = await seedTrip(db, userId, { organizationId: org.id });
    await seedDestination(db, trip.id, {
      startDate: new Date('2026-09-10'),
      endDate: new Date('2026-09-14'),
    });
    await seedDestination(db, trip.id, {
      startDate: new Date('2026-09-01'),
      endDate: new Date('2026-09-05'),
    });
    await seedDestination(db, trip.id, {
      startDate: new Date('2026-09-15'),
      endDate: new Date('2026-09-21'),
    });

    const [summary] = await run(userId);

    expect(summary?.startDate).toBe('2026-09-01');
    expect(summary?.endDate).toBe('2026-09-21');
  });

  it('returns null dates for a trip with no destinations', async () => {
    const { id: userId } = await seedUser(db);
    const org = await seedOrganization(db, userId);
    await seedTrip(db, userId, { organizationId: org.id });

    const [summary] = await run(userId);

    expect(summary?.startDate).toBeNull();
    expect(summary?.endDate).toBeNull();
  });

  it('derives dates independently when destinations carry only one side', async () => {
    const { id: userId } = await seedUser(db);
    const org = await seedOrganization(db, userId);
    const trip = await seedTrip(db, userId, { organizationId: org.id });
    await seedDestination(db, trip.id, { startDate: new Date('2026-09-01'), endDate: null });
    await seedDestination(db, trip.id, { startDate: null, endDate: null });

    const [summary] = await run(userId);

    expect(summary?.startDate).toBe('2026-09-01');
    expect(summary?.endDate).toBeNull();
  });

  it('does not mix destination dates across trips', async () => {
    const { id: userId } = await seedUser(db);
    const org = await seedOrganization(db, userId);
    const datedTrip = await seedTrip(db, userId, { organizationId: org.id, name: 'Dated' });
    const undatedTrip = await seedTrip(db, userId, { organizationId: org.id, name: 'Undated' });
    await seedDestination(db, datedTrip.id, {
      startDate: new Date('2026-07-01'),
      endDate: new Date('2026-07-10'),
    });
    await seedDestination(db, undatedTrip.id, { startDate: null, endDate: null });

    const summaries = await run(userId);
    const dated = summaries.find((s) => s.id === datedTrip.id);
    const undated = summaries.find((s) => s.id === undatedTrip.id);

    expect(dated?.startDate).toBe('2026-07-01');
    expect(dated?.endDate).toBe('2026-07-10');
    expect(undated?.startDate).toBeNull();
    expect(undated?.endDate).toBeNull();
  });

  it('maps the trip fields onto the TripSummary wire shape', async () => {
    const { id: userId } = await seedUser(db);
    const org = await seedOrganization(db, userId);
    const trip = await seedTrip(db, userId, {
      organizationId: org.id,
      name: 'Japan 2026',
      totalBudgetPence: 500_000,
      status: 'active',
    });

    const [summary] = await run(userId);

    expect(summary).toEqual({
      id: trip.id,
      name: 'Japan 2026',
      status: 'active',
      totalBudget: { amountPence: 500_000, currency: 'GBP' },
      startDate: null,
      endDate: null,
      organizationId: org.id,
      updatedAt: trip.updatedAt.toISOString(),
    });
  });

  it('orders trips newest-created first across organisations (matches the web list)', async () => {
    const { id: userId } = await seedUser(db);
    const org = await seedOrganization(db, userId);
    const older = await seedTrip(db, userId, { organizationId: org.id, name: 'Older' });
    // Force a distinct createdAt for deterministic ordering.
    await new Promise((r) => setTimeout(r, 5));
    const newer = await seedTrip(db, userId, { organizationId: org.id, name: 'Newer' });

    const summaries = await run(userId);

    expect(summaries.map((s) => s.id)).toEqual([newer.id, older.id]);
  });
});
