import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { DrizzleUserAccessRepository } from '@/infrastructure/db/repositories/drizzle-user-access-repository';
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
import { deleteUser } from './delete-user';

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

describe('deleteUser', () => {
  it('rejects non-admin actors', async () => {
    const actor = await seedUser(db, {
      email: 'member@example.com',
      isApproved: true,
      isAdmin: false,
    });
    const target = await seedUser(db, {
      email: 'target@example.com',
      isApproved: true,
      isAdmin: false,
    });

    const repository = new DrizzleUserAccessRepository(db);
    const result = await deleteUser(repository, {
      actorUserId: actor.id,
      targetUserId: target.id,
    });

    expect(result).toEqual({ ok: false, error: 'Forbidden' });
  });

  it('rejects self-deletion', async () => {
    const admin = await seedUser(db, {
      email: 'admin@example.com',
      isApproved: true,
      isAdmin: true,
    });

    const repository = new DrizzleUserAccessRepository(db);
    const result = await deleteUser(repository, {
      actorUserId: admin.id,
      targetUserId: admin.id,
    });

    expect(result).toEqual({ ok: false, error: 'You cannot delete your own account' });
  });

  it('rejects deleting another admin', async () => {
    const admin = await seedUser(db, {
      email: 'admin@example.com',
      isApproved: true,
      isAdmin: true,
    });
    const otherAdmin = await seedUser(db, {
      email: 'other-admin@example.com',
      isApproved: true,
      isAdmin: true,
    });

    const repository = new DrizzleUserAccessRepository(db);
    const result = await deleteUser(repository, {
      actorUserId: admin.id,
      targetUserId: otherAdmin.id,
    });

    expect(result).toEqual({
      ok: false,
      error: 'Cannot delete an admin user. Remove their admin role first',
    });
  });

  it('blocks deletion when user is sole owner of an org', async () => {
    const admin = await seedUser(db, {
      email: 'admin@example.com',
      isApproved: true,
      isAdmin: true,
    });
    const target = await seedUser(db, {
      email: 'target@example.com',
      isApproved: true,
      isAdmin: false,
    });
    await seedOrganization(db, target.id, { name: 'Sole Owner Org' });

    const repository = new DrizzleUserAccessRepository(db);
    const result = await deleteUser(repository, {
      actorUserId: admin.id,
      targetUserId: target.id,
    });

    expect(result).toEqual({
      ok: false,
      error: 'User is the sole owner of: Sole Owner Org. Transfer ownership before deleting',
    });
  });

  it('allows deletion when user is co-owner (not sole owner)', async () => {
    const admin = await seedUser(db, {
      email: 'admin@example.com',
      isApproved: true,
      isAdmin: true,
    });
    const target = await seedUser(db, {
      email: 'target@example.com',
      isApproved: true,
      isAdmin: false,
    });
    const org = await seedOrganization(db, target.id, { name: 'Shared Org' });
    await seedOrganizationMember(db, org.id, admin.id, 'owner');

    const repository = new DrizzleUserAccessRepository(db);
    const result = await deleteUser(repository, {
      actorUserId: admin.id,
      targetUserId: target.id,
    });

    expect(result).toEqual({ ok: true, value: undefined });
  });

  it('anonymizes user and removes memberships, preserving org/trip data', async () => {
    const admin = await seedUser(db, {
      email: 'admin@example.com',
      isApproved: true,
      isAdmin: true,
    });
    const target = await seedUser(db, {
      email: 'target@example.com',
      isApproved: true,
      isAdmin: false,
    });

    const org = await seedOrganization(db, admin.id, { name: 'Preserved Org' });
    await seedOrganizationMember(db, org.id, target.id, 'member');
    await seedTrip(db, admin.id, { organizationId: org.id, name: 'Preserved Trip' });

    const repository = new DrizzleUserAccessRepository(db);
    const result = await deleteUser(repository, {
      actorUserId: admin.id,
      targetUserId: target.id,
    });

    expect(result).toEqual({ ok: true, value: undefined });

    const anonymized = await repository.findById(target.id);
    expect(anonymized).not.toBeNull();
    expect(anonymized?.name).toBe('Deleted User');
    expect(anonymized?.firstName).toBe('Deleted');
    expect(anonymized?.lastName).toBe('User');
    expect(anonymized?.email).toBe(`deleted-${target.id}@anonymized.local`);
    expect(anonymized?.isApproved).toBe(false);
    expect(anonymized?.isAdmin).toBe(false);

    // Deleted user should not appear in listAll
    const allUsers = await repository.listAll();
    expect(allUsers.find((u) => u.id === target.id)).toBeUndefined();

    // Organization and trip should still exist
    const adminList = allUsers.find((u) => u.id === admin.id);
    expect(adminList).toBeDefined();
    expect(adminList?.organizations.some((o) => o.organizationName === 'Preserved Org')).toBe(true);
  });

  it('returns error when target user does not exist', async () => {
    const admin = await seedUser(db, {
      email: 'admin@example.com',
      isApproved: true,
      isAdmin: true,
    });

    const repository = new DrizzleUserAccessRepository(db);
    const result = await deleteUser(repository, {
      actorUserId: admin.id,
      targetUserId: 'nonexistent-id',
    });

    expect(result).toEqual({ ok: false, error: 'User not found' });
  });
});
