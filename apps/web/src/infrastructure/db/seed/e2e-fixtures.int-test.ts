import { count, eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestDb, type Db, type Sql, truncateAll } from '../../testing/helpers';
import {
  destinations,
  organizationMemberships,
  spendEntries,
  tripFixedCosts,
  trips,
  users,
} from '../schema';
import { applyE2eFixtures, E2E_FIXTURES } from './e2e-fixtures';

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

describe('applyE2eFixtures', () => {
  it('seeds the approved e2e user with org membership', async () => {
    await applyE2eFixtures(db);

    const [user] = await db.select().from(users).where(eq(users.id, E2E_FIXTURES.user.id));
    expect(user).toBeDefined();
    expect(user.email).toBe(E2E_FIXTURES.user.email);
    expect(user.isApproved).toBe(true);

    const memberships = await db
      .select()
      .from(organizationMemberships)
      .where(eq(organizationMemberships.userId, E2E_FIXTURES.user.id));
    expect(memberships).toHaveLength(1);
    expect(memberships[0].organizationId).toBe(E2E_FIXTURES.organization.id);
  });

  it('seeds the deterministic trip with destinations, fixed costs, and spend', async () => {
    await applyE2eFixtures(db);

    const [trip] = await db.select().from(trips).where(eq(trips.id, E2E_FIXTURES.trip.id));
    expect(trip).toBeDefined();
    expect(trip.name).toBe(E2E_FIXTURES.trip.name);
    expect(trip.organizationId).toBe(E2E_FIXTURES.organization.id);
    expect(trip.totalBudgetAmount).toBe(E2E_FIXTURES.trip.totalBudgetPence);

    const tripDestinations = await db
      .select()
      .from(destinations)
      .where(eq(destinations.tripId, E2E_FIXTURES.trip.id));
    expect(tripDestinations.map((d) => d.id).sort()).toEqual(
      E2E_FIXTURES.destinations.map((d) => d.id).sort(),
    );

    const costs = await db
      .select()
      .from(tripFixedCosts)
      .where(eq(tripFixedCosts.tripId, E2E_FIXTURES.trip.id));
    expect(costs).toHaveLength(E2E_FIXTURES.fixedCosts.length);

    for (const fixtureEntry of E2E_FIXTURES.spendEntries) {
      const [row] = await db
        .select()
        .from(spendEntries)
        .where(eq(spendEntries.id, fixtureEntry.id));
      expect(row).toBeDefined();
      expect(row.amount).toBe(fixtureEntry.amountPence);
      expect(row.destinationId).toBe(fixtureEntry.destinationId);
    }
  });

  it('is idempotent — applying twice leaves exactly one copy of everything', async () => {
    await applyE2eFixtures(db);
    await applyE2eFixtures(db);

    const [{ value: userCount }] = await db
      .select({ value: count() })
      .from(users)
      .where(eq(users.id, E2E_FIXTURES.user.id));
    expect(userCount).toBe(1);

    const [{ value: tripCount }] = await db
      .select({ value: count() })
      .from(trips)
      .where(eq(trips.id, E2E_FIXTURES.trip.id));
    expect(tripCount).toBe(1);

    const [{ value: destinationCount }] = await db
      .select({ value: count() })
      .from(destinations)
      .where(eq(destinations.tripId, E2E_FIXTURES.trip.id));
    expect(destinationCount).toBe(E2E_FIXTURES.destinations.length);

    const [{ value: spendCount }] = await db.select({ value: count() }).from(spendEntries);
    expect(spendCount).toBe(E2E_FIXTURES.spendEntries.length);
  });
});
