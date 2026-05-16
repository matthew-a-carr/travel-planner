import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { DrizzleOrganizationRepository } from '@/infrastructure/db/repositories/drizzle-organization-repository';
import { DrizzleTripRepository } from '@/infrastructure/db/repositories/drizzle-trip-repository';
import {
  createTestDb,
  type Db,
  type Sql,
  seedOrganization,
  seedOrganizationMember,
  seedTrip,
  seedUser,
  truncateAll,
} from '@/infrastructure/testing/helpers';
import { deleteTrip } from './delete-trip';

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

describe('deleteTrip', () => {
  it('deletes the trip when actor is an organization owner', async () => {
    const { id: ownerUserId } = await seedUser(db, { email: 'owner@example.com' });
    const organization = await seedOrganization(db, ownerUserId, { name: 'Shared Planning' });
    const trip = await seedTrip(db, ownerUserId, { organizationId: organization.id });

    const result = await deleteTrip(
      new DrizzleTripRepository(db),
      new DrizzleOrganizationRepository(db),
      {
        actorUserId: ownerUserId,
        tripId: trip.id,
      },
    );

    expect(result.ok).toBe(true);
    expect(await new DrizzleTripRepository(db).findById(trip.id)).toBeNull();
  });

  it('returns Forbidden when actor is a non-owner organization member', async () => {
    const { id: ownerUserId } = await seedUser(db, { email: 'owner@example.com' });
    const { id: memberUserId } = await seedUser(db, { email: 'member@example.com' });
    const organization = await seedOrganization(db, ownerUserId, { name: 'Shared Planning' });
    await seedOrganizationMember(db, organization.id, memberUserId, 'member');
    const trip = await seedTrip(db, ownerUserId, { organizationId: organization.id });

    const result = await deleteTrip(
      new DrizzleTripRepository(db),
      new DrizzleOrganizationRepository(db),
      {
        actorUserId: memberUserId,
        tripId: trip.id,
      },
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('Forbidden');
  });

  it('returns Trip not found when the trip does not exist', async () => {
    const { id: ownerUserId } = await seedUser(db, { email: 'owner@example.com' });
    await seedOrganization(db, ownerUserId, { name: 'Shared Planning' });

    const result = await deleteTrip(
      new DrizzleTripRepository(db),
      new DrizzleOrganizationRepository(db),
      {
        actorUserId: ownerUserId,
        tripId: crypto.randomUUID(),
      },
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('Trip not found');
  });
});
