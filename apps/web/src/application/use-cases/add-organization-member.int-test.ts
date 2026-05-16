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
import { addOrganizationMember } from './add-organization-member';

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

describe('addOrganizationMember', () => {
  it('adds an existing user to organization when actor is owner', async () => {
    const { id: ownerUserId } = await seedUser(db, { email: 'owner@example.com' });
    const { id: targetUserId } = await seedUser(db, { email: 'partner@example.com' });
    const organization = await seedOrganization(db, ownerUserId, { name: 'Shared Planning' });
    const repo = new DrizzleOrganizationRepository(db);

    const result = await addOrganizationMember(repo, {
      actorUserId: ownerUserId,
      organizationId: organization.id,
      targetUserId,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const membership = await repo.findMembership(organization.id, targetUserId);
    expect(membership?.role).toBe('member');
  });

  it('rejects when target user has not signed in', async () => {
    const { id: ownerUserId } = await seedUser(db, { email: 'owner@example.com' });
    const organization = await seedOrganization(db, ownerUserId, { name: 'Shared Planning' });
    const repo = new DrizzleOrganizationRepository(db);

    const result = await addOrganizationMember(repo, {
      actorUserId: ownerUserId,
      organizationId: organization.id,
      targetUserId: crypto.randomUUID(),
    });

    expect(result.ok).toBe(false);
  });

  it('rejects when actor is not owner', async () => {
    const { id: ownerUserId } = await seedUser(db, { email: 'owner@example.com' });
    const { id: memberUserId } = await seedUser(db, { email: 'member@example.com' });
    const { id: targetUserId } = await seedUser(db, { email: 'target@example.com' });
    const organization = await seedOrganization(db, ownerUserId, { name: 'Shared Planning' });
    const repo = new DrizzleOrganizationRepository(db);

    await repo.addMember({
      organizationId: organization.id,
      userId: memberUserId,
      role: 'member',
      createdAt: new Date(),
    });

    const result = await addOrganizationMember(repo, {
      actorUserId: memberUserId,
      organizationId: organization.id,
      targetUserId,
    });

    expect(result.ok).toBe(false);
    const membership = await repo.findMembership(organization.id, targetUserId);
    expect(membership).toBeNull();
  });
});
