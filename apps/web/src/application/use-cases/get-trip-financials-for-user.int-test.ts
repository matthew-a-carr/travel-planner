import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { DrizzleDestinationRepository } from '../../infrastructure/db/repositories/drizzle-destination-repository';
import { DrizzleOrganizationRepository } from '../../infrastructure/db/repositories/drizzle-organization-repository';
import { DrizzleSpendEntryRepository } from '../../infrastructure/db/repositories/drizzle-spend-entry-repository';
import { DrizzleTripRepository } from '../../infrastructure/db/repositories/drizzle-trip-repository';
import {
  createTestDb,
  type Db,
  type Sql,
  seedDestination,
  seedOrganization,
  seedOrganizationMember,
  seedSpendEntry,
  seedTrip,
  seedUser,
  truncateAll,
} from '../../infrastructure/testing/helpers';
import { getTripFinancialsForUser } from './get-trip-financials-for-user';

let db: Db;
let sql: Sql;

beforeAll(() => ({ db, sql } = createTestDb()));
afterAll(async () => sql.end());
beforeEach(async () => truncateAll(db));

async function run(userId: string, tripId: string, currentDate = new Date('2026-06-16T12:00:00Z')) {
  return getTripFinancialsForUser(
    new DrizzleOrganizationRepository(db),
    new DrizzleTripRepository(db),
    new DrizzleDestinationRepository(db),
    new DrizzleSpendEntryRepository(db),
    userId,
    tripId,
    currentDate,
  );
}

describe('getTripFinancialsForUser', () => {
  it('returns null for a missing trip or caller outside the organization', async () => {
    const { id: owner } = await seedUser(db);
    const org = await seedOrganization(db, owner);
    const trip = await seedTrip(db, owner, { organizationId: org.id });
    const { id: outsider } = await seedUser(db);

    expect(await run(owner, crypto.randomUUID())).toBeNull();
    expect(await run(outsider, trip.id)).toBeNull();
  });

  it('allows an organization member and returns the empty financial state', async () => {
    const { id: owner } = await seedUser(db);
    const org = await seedOrganization(db, owner);
    const trip = await seedTrip(db, owner, { organizationId: org.id });
    const { id: member } = await seedUser(db);
    await seedOrganizationMember(db, org.id, member, 'member');

    expect(await run(member, trip.id)).toEqual({
      entries: [],
      categoryTotals: [],
      burndown: null,
      alerts: [],
    });
  });

  it('maps newest-first entries, category totals, canonical burndown, and alerts', async () => {
    const { id: owner } = await seedUser(db);
    const org = await seedOrganization(db, owner);
    const trip = await seedTrip(db, owner, { organizationId: org.id });
    const destination = await seedDestination(db, trip.id, {
      estimatedBudgetPence: 100_000,
      startDate: new Date('2026-06-01T00:00:00Z'),
      endDate: new Date('2026-06-21T00:00:00Z'),
    });
    const older = await seedSpendEntry(db, destination.id, {
      amountPence: 20_000,
      category: 'food',
      description: 'Meals',
      spentAt: new Date('2026-06-05T00:00:00Z'),
    });
    const newer = await seedSpendEntry(db, destination.id, {
      amountPence: 50_000,
      category: 'transport',
      description: 'Rail pass',
      spentAt: new Date('2026-06-15T00:00:00Z'),
    });

    const result = await run(owner, trip.id);

    expect(result?.entries.map((entry) => entry.id)).toEqual([newer.id, older.id]);
    expect(result?.entries[0]).toMatchObject({
      destinationId: destination.id,
      amount: { amountPence: 50_000, currency: 'GBP' },
      category: 'transport',
      description: 'Rail pass',
      spentAt: '2026-06-15',
    });
    expect(result?.categoryTotals).toEqual([
      { category: 'transport', amountPence: 50_000 },
      { category: 'food', amountPence: 20_000 },
    ]);
    expect(result?.burndown).toMatchObject({
      dailyPacePence: 4667,
      targetPacePence: 5000,
      projectedExhaustionDate: null,
    });
    expect(result?.burndown?.actualLine.at(-1)?.amountPence).toBe(30_000);
    expect(result?.alerts.some((alert) => alert.type === 'single-day-spike')).toBe(true);
  });
});
