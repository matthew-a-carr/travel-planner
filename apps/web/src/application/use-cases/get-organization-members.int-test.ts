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
import { getOrganizationMembers } from './get-organization-members';

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

describe('getOrganizationMembers', () => {
  it('returns members and management capability for owners', async () => {
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

    const result = await getOrganizationMembers(repo, organization.id, ownerUserId);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.canManageMembers).toBe(true);
    expect(result.value.members).toHaveLength(2);
  });

  it('returns no-management capability for members', async () => {
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

    const result = await getOrganizationMembers(repo, organization.id, memberUserId);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.canManageMembers).toBe(false);
  });
});
