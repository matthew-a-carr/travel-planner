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
import { moveTripToOrganization } from './move-trip-to-organization';

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

describe('moveTripToOrganization', () => {
  it('moves a trip when actor is owner of source and target organizations', async () => {
    const { id: ownerUserId } = await seedUser(db, { email: 'owner@example.com' });
    const sourceOrganization = await seedOrganization(db, ownerUserId, { name: 'Source Org' });
    const targetOrganization = await seedOrganization(db, ownerUserId, { name: 'Target Org' });
    const trip = await seedTrip(db, ownerUserId, { organizationId: sourceOrganization.id });

    const result = await moveTripToOrganization(
      new DrizzleTripRepository(db),
      new DrizzleOrganizationRepository(db),
      {
        actorUserId: ownerUserId,
        tripId: trip.id,
        targetOrganizationId: targetOrganization.id,
      },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.organizationId).toBe(targetOrganization.id);
  });

  it('rejects when actor is not owner of source organization', async () => {
    const { id: ownerUserId } = await seedUser(db, { email: 'owner@example.com' });
    const { id: memberUserId } = await seedUser(db, { email: 'member@example.com' });
    const sourceOrganization = await seedOrganization(db, ownerUserId, { name: 'Source Org' });
    const targetOrganization = await seedOrganization(db, ownerUserId, { name: 'Target Org' });
    await seedOrganizationMember(db, sourceOrganization.id, memberUserId, 'member');
    await seedOrganizationMember(db, targetOrganization.id, memberUserId, 'member');
    const trip = await seedTrip(db, ownerUserId, { organizationId: sourceOrganization.id });

    const result = await moveTripToOrganization(
      new DrizzleTripRepository(db),
      new DrizzleOrganizationRepository(db),
      {
        actorUserId: memberUserId,
        tripId: trip.id,
        targetOrganizationId: targetOrganization.id,
      },
    );

    expect(result.ok).toBe(false);
  });
});
