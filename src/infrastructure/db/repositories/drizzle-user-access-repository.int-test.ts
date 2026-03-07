import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  createTestDb,
  type Db,
  type Sql,
  seedOrganization,
  seedOrganizationMember,
  seedUser,
  truncateAll,
} from '@/infrastructure/testing/helpers';
import { accounts } from '../schema';
import { DrizzleUserAccessRepository } from './drizzle-user-access-repository';

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

describe('DrizzleUserAccessRepository', () => {
  it('lists users with linked providers and organizations', async () => {
    const owner = await seedUser(db, {
      email: 'owner@example.com',
      name: 'Owner User',
      isApproved: true,
      isAdmin: true,
    });
    const member = await seedUser(db, {
      email: 'member@example.com',
      name: 'Member User',
      isApproved: true,
      isAdmin: false,
    });
    const organization = await seedOrganization(db, owner.id, { name: 'Shared Planning' });
    await seedOrganizationMember(db, organization.id, member.id, 'member');

    await db.insert(accounts).values({
      userId: owner.id,
      type: 'oauth',
      provider: 'google',
      providerAccountId: 'google-owner',
      refresh_token: null,
      access_token: null,
      expires_at: null,
      token_type: null,
      scope: null,
      id_token: null,
      session_state: null,
    });

    const repository = new DrizzleUserAccessRepository(db);
    const users = await repository.listAll();

    expect(users).toHaveLength(2);
    const listedOwner = users.find((user) => user.id === owner.id);
    expect(listedOwner?.idps).toEqual([
      {
        provider: 'google',
        providerAccountId: 'google-owner',
      },
    ]);
    expect(listedOwner?.organizations[0]?.organizationName).toBe('Shared Planning');
    expect(listedOwner?.organizations[0]?.role).toBe('owner');
  });

  it('updates approval/admin flags', async () => {
    const user = await seedUser(db, {
      email: 'user@example.com',
      isApproved: false,
      isAdmin: false,
    });

    const repository = new DrizzleUserAccessRepository(db);

    await repository.updateApproval(user.id, true);
    await repository.updateAdmin(user.id, true);

    const updated = await repository.findById(user.id);
    expect(updated?.isApproved).toBe(true);
    expect(updated?.isAdmin).toBe(true);
  });

  it('creates a new user when pre-provisioning by email', async () => {
    const repository = new DrizzleUserAccessRepository(db);

    const created = await repository.createOrApproveByEmail({
      email: 'Pre.Prov+alias@GoogleMail.com',
      name: 'Pre Provisioned',
      isApproved: true,
      isAdmin: false,
    });

    expect(created.user.email).toBe('preprov@gmail.com');
    expect(created.user.isApproved).toBe(true);
    expect(created.user.isAdmin).toBe(false);
    expect(created.user.firstName).toBe('Pre');
    expect(created.user.lastName).toBe('Provisioned');
    expect(created.approvalTransition).toBe('approved_now');
  });

  it('updates existing canonical email users idempotently', async () => {
    const existing = await seedUser(db, {
      email: 'existing.user@gmail.com',
      name: 'Existing User',
      isApproved: false,
      isAdmin: false,
    });
    const repository = new DrizzleUserAccessRepository(db);

    const updated = await repository.createOrApproveByEmail({
      email: 'existinguser+alias@googlemail.com',
      name: 'Updated Name',
      isApproved: true,
      isAdmin: false,
    });

    expect(updated.user.id).toBe(existing.id);
    expect(updated.user.email).toBe('existinguser@gmail.com');
    expect(updated.user.name).toBe('Updated Name');
    expect(updated.user.isApproved).toBe(true);
    expect(updated.approvalTransition).toBe('approved_now');
  });

  it('returns already_approved transition when canonical user is already approved', async () => {
    await seedUser(db, {
      email: 'already.approved@gmail.com',
      name: 'Already Approved',
      isApproved: true,
      isAdmin: false,
    });
    const repository = new DrizzleUserAccessRepository(db);

    const updated = await repository.createOrApproveByEmail({
      email: 'alreadyapproved+alias@googlemail.com',
      name: 'Already Approved',
      isApproved: true,
      isAdmin: false,
    });

    expect(updated.user.isApproved).toBe(true);
    expect(updated.approvalTransition).toBe('already_approved');
  });
});
