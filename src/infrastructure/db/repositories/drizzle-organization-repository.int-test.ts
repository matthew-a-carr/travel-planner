import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  createTestDb,
  type Db,
  type Sql,
  seedUser,
  truncateAll,
} from '@/infrastructure/testing/helpers';
import { DrizzleOrganizationRepository } from './drizzle-organization-repository';

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

describe('DrizzleOrganizationRepository', () => {
  it('creates organization with owner membership in one call', async () => {
    const { id: ownerUserId } = await seedUser(db, { email: 'owner@example.com' });
    const repo = new DrizzleOrganizationRepository(db);
    const organizationId = crypto.randomUUID();
    const now = new Date();

    const organization = await repo.createOrganizationWithOwner({
      organizationId,
      name: "Owner's Workspace",
      ownerUserId,
      createdAt: now,
      updatedAt: now,
    });

    expect(organization.id).toBe(organizationId);
    expect(organization.createdByUserId).toBe(ownerUserId);

    const membership = await repo.findMembership(organizationId, ownerUserId);
    expect(membership?.role).toBe('owner');
  });

  it('finds organizations for a user with role', async () => {
    const { id: ownerUserId } = await seedUser(db, { email: 'owner@example.com' });
    const repo = new DrizzleOrganizationRepository(db);
    const now = new Date();
    const first = await repo.createOrganizationWithOwner({
      organizationId: crypto.randomUUID(),
      name: "Owner's Workspace",
      ownerUserId,
      createdAt: now,
      updatedAt: now,
    });

    const second = await repo.createOrganizationWithOwner({
      organizationId: crypto.randomUUID(),
      name: 'Shared Planning',
      ownerUserId,
      createdAt: new Date(now.getTime() + 10),
      updatedAt: new Date(now.getTime() + 10),
    });

    const organizations = await repo.findOrganizationsForUser(ownerUserId);
    expect(organizations.map((entry) => entry.organization.id)).toEqual([first.id, second.id]);
    expect(organizations.every((entry) => entry.role === 'owner')).toBe(true);
  });

  it('findUserByEmail is case-insensitive', async () => {
    await seedUser(db, { email: 'Partner@Example.com' });
    const repo = new DrizzleOrganizationRepository(db);

    const user = await repo.findUserByEmail('partner@example.com');
    expect(user?.email).toBe('Partner@Example.com');
  });

  it('adds and lists organization members', async () => {
    const { id: ownerUserId } = await seedUser(db, { email: 'owner@example.com' });
    const { id: memberUserId } = await seedUser(db, { email: 'member@example.com' });
    const repo = new DrizzleOrganizationRepository(db);
    const now = new Date();
    const organization = await repo.createOrganizationWithOwner({
      organizationId: crypto.randomUUID(),
      name: 'Shared Planning',
      ownerUserId,
      createdAt: now,
      updatedAt: now,
    });

    await repo.addMember({
      organizationId: organization.id,
      userId: memberUserId,
      role: 'member',
      createdAt: new Date(now.getTime() + 20),
    });

    const members = await repo.listMembers(organization.id);
    expect(members).toHaveLength(2);
    expect(members.find((member) => member.userId === ownerUserId)?.role).toBe('owner');
    expect(members.find((member) => member.userId === memberUserId)?.role).toBe('member');
  });

  it('removes a member from an organization', async () => {
    const { id: ownerUserId } = await seedUser(db, { email: 'owner@example.com' });
    const { id: memberUserId } = await seedUser(db, { email: 'member@example.com' });
    const repo = new DrizzleOrganizationRepository(db);
    const now = new Date();
    const organization = await repo.createOrganizationWithOwner({
      organizationId: crypto.randomUUID(),
      name: 'Shared Planning',
      ownerUserId,
      createdAt: now,
      updatedAt: now,
    });

    await repo.addMember({
      organizationId: organization.id,
      userId: memberUserId,
      role: 'member',
      createdAt: new Date(now.getTime() + 20),
    });
    await repo.removeMember(organization.id, memberUserId);

    const members = await repo.listMembers(organization.id);
    expect(members.map((member) => member.userId)).toEqual([ownerUserId]);
  });
});
