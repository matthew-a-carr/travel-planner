import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { InviteEmailService } from '@/application/ports/invite-email-service';
import { DrizzleUserAccessRepository } from '@/infrastructure/db/repositories/drizzle-user-access-repository';
import {
  createTestDb,
  type Db,
  type Sql,
  seedUser,
  truncateAll,
} from '@/infrastructure/testing/helpers';
import { preProvisionUserAccess } from './pre-provision-user-access';

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

describe('preProvisionUserAccess (integration)', () => {
  function createStubInviteEmailService(): InviteEmailService {
    return {
      sendUserAddedInvite: async () => ({
        ok: true,
        providerMessageId: null,
      }),
    };
  }

  it('admin can pre-provision an approved non-admin user', async () => {
    const admin = await seedUser(db, {
      email: 'admin@example.com',
      isApproved: true,
      isAdmin: true,
    });
    const repository = new DrizzleUserAccessRepository(db);
    const inviteEmailService = createStubInviteEmailService();

    const result = await preProvisionUserAccess(repository, inviteEmailService, {
      actorUserId: admin.id,
      email: 'new.member@example.com',
      name: 'New Member',
      loginUrl: 'http://localhost:3000/login',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.user.isApproved).toBe(true);
    expect(result.value.user.isAdmin).toBe(false);
    expect(result.value.user.firstName).toBe('New');
    expect(result.value.user.lastName).toBe('Member');
    expect(result.value.approvalTransition).toBe('approved_now');
    expect(result.value.inviteDelivery.status).toBe('sent');
  });

  it('is idempotent for existing canonicalized emails and sets approval', async () => {
    const admin = await seedUser(db, {
      email: 'admin@example.com',
      isApproved: true,
      isAdmin: true,
    });
    const existing = await seedUser(db, {
      email: 'jane.doe@gmail.com',
      isApproved: false,
      isAdmin: false,
      name: 'Legacy Name',
    });
    const repository = new DrizzleUserAccessRepository(db);
    const inviteEmailService = createStubInviteEmailService();

    const result = await preProvisionUserAccess(repository, inviteEmailService, {
      actorUserId: admin.id,
      email: 'j.a.n.e.d.o.e+new@googlemail.com',
      name: 'Jane Doe',
      loginUrl: 'http://localhost:3000/login',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.user.id).toBe(existing.id);
    expect(result.value.user.email).toBe('janedoe@gmail.com');
    expect(result.value.user.isApproved).toBe(true);
    expect(result.value.user.name).toBe('Jane Doe');
    expect(result.value.approvalTransition).toBe('approved_now');
    expect(result.value.inviteDelivery.status).toBe('sent');
  });

  it('does not send invite when user was already approved', async () => {
    const admin = await seedUser(db, {
      email: 'admin@example.com',
      isApproved: true,
      isAdmin: true,
    });
    await seedUser(db, {
      email: 'approved.member@example.com',
      isApproved: true,
      isAdmin: false,
      name: 'Approved Member',
    });
    const repository = new DrizzleUserAccessRepository(db);
    const inviteEmailService: InviteEmailService = {
      sendUserAddedInvite: async () => {
        throw new Error('Invite should not be called');
      },
    };

    const result = await preProvisionUserAccess(repository, inviteEmailService, {
      actorUserId: admin.id,
      email: 'approved.member@example.com',
      name: 'Approved Member',
      loginUrl: 'http://localhost:3000/login',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.approvalTransition).toBe('already_approved');
    expect(result.value.inviteDelivery).toEqual({ status: 'skipped' });
  });

  it('forbids non-admin actors', async () => {
    const member = await seedUser(db, {
      email: 'member@example.com',
      isApproved: true,
      isAdmin: false,
    });
    const repository = new DrizzleUserAccessRepository(db);
    const inviteEmailService = createStubInviteEmailService();

    const result = await preProvisionUserAccess(repository, inviteEmailService, {
      actorUserId: member.id,
      email: 'new.member@example.com',
      name: null,
      loginUrl: 'http://localhost:3000/login',
    });

    expect(result).toEqual({ ok: false, error: 'Forbidden' });
  });

  it('keeps provisioning successful when invite delivery fails', async () => {
    const admin = await seedUser(db, {
      email: 'admin@example.com',
      isApproved: true,
      isAdmin: true,
    });
    const repository = new DrizzleUserAccessRepository(db);
    const inviteEmailService: InviteEmailService = {
      sendUserAddedInvite: async () => ({
        ok: false,
        error: 'simulated provider failure',
      }),
    };

    const result = await preProvisionUserAccess(repository, inviteEmailService, {
      actorUserId: admin.id,
      email: 'invite.failure@example.com',
      name: 'Invite Failure',
      loginUrl: 'http://localhost:3000/login',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.user.isApproved).toBe(true);
    expect(result.value.inviteDelivery).toEqual({
      status: 'failed',
      error: 'simulated provider failure',
    });
  });
});
