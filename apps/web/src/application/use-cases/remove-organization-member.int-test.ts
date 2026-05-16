import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { DrizzleOrganizationRepository } from '@/infrastructure/db/repositories/drizzle-organization-repository';
import {
  createTestDb,
  type Db,
  type Sql,
  seedOrganization,
  seedUser,
  truncateAll,
} from '@/infrastructure/testing/helpers';
import { removeOrganizationMember } from './remove-organization-member';

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

describe('removeOrganizationMember', () => {
  it('removes a non-owner member when actor is owner', async () => {
    const { id: ownerUserId } = await seedUser(db, { email: 'owner@example.com' });
    const { id: memberUserId } = await seedUser(db, { email: 'member@example.com' });
    const organization = await seedOrganization(db, ownerUserId, { name: 'Shared Planning' });
    const repo = new DrizzleOrganizationRepository(db);
    await repo.addMember({
      organizationId: organization.id,
      userId: memberUserId,
      role: 'member',
      createdAt: new Date(),
    });

    const result = await removeOrganizationMember(repo, {
      actorUserId: ownerUserId,
      organizationId: organization.id,
      memberUserId,
    });

    expect(result.ok).toBe(true);
    const membership = await repo.findMembership(organization.id, memberUserId);
    expect(membership).toBeNull();
  });

  it('rejects removing organization owner', async () => {
    const { id: ownerUserId } = await seedUser(db, { email: 'owner@example.com' });
    const organization = await seedOrganization(db, ownerUserId, { name: 'Shared Planning' });
    const repo = new DrizzleOrganizationRepository(db);

    const result = await removeOrganizationMember(repo, {
      actorUserId: ownerUserId,
      organizationId: organization.id,
      memberUserId: ownerUserId,
    });

    expect(result.ok).toBe(false);
  });
});
