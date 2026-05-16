import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { InviteEmailService } from '@/application/ports/invite-email-service';
import { DrizzleUserAccessRepository } from '@/infrastructure/db/repositories/drizzle-user-access-repository';
import {
  createTestDb,
  type Db,
  type Sql,
  seedUser,
  truncateAll,
} from '@/infrastructure/testing/helpers';
import { sendUserAccessInvite } from './send-user-access-invite';

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

describe('sendUserAccessInvite (integration)', () => {
  it('allows admins to resend invites for approved users', async () => {
    const admin = await seedUser(db, {
      email: 'admin@example.com',
      name: 'Admin User',
      isApproved: true,
      isAdmin: true,
    });
    const target = await seedUser(db, {
      email: 'member@example.com',
      name: 'Member User',
      isApproved: true,
      isAdmin: false,
    });
    const repository = new DrizzleUserAccessRepository(db);
    const inviteEmailService: InviteEmailService = {
      sendUserAddedInvite: vi.fn(async () => ({
        ok: true as const,
        providerMessageId: 'msg_123',
      })),
    };

    const result = await sendUserAccessInvite(repository, inviteEmailService, {
      actorUserId: admin.id,
      targetUserId: target.id,
      loginUrl: 'https://travel.matthewcarr.dev/login',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.user.id).toBe(target.id);
    expect(result.value.inviteDelivery).toEqual({
      status: 'sent',
      providerMessageId: 'msg_123',
    });
    expect(inviteEmailService.sendUserAddedInvite).toHaveBeenCalledWith({
      recipient: expect.objectContaining({ id: target.id }),
      inviter: expect.objectContaining({ id: admin.id }),
      loginUrl: 'https://travel.matthewcarr.dev/login',
    });
  });

  it('forbids non-admin users', async () => {
    const member = await seedUser(db, {
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
    const inviteEmailService: InviteEmailService = {
      sendUserAddedInvite: vi.fn(async () => ({
        ok: true as const,
        providerMessageId: null,
      })),
    };

    const result = await sendUserAccessInvite(repository, inviteEmailService, {
      actorUserId: member.id,
      targetUserId: target.id,
      loginUrl: 'http://localhost:3000/login',
    });

    expect(result).toEqual({ ok: false, error: 'Forbidden' });
    expect(inviteEmailService.sendUserAddedInvite).not.toHaveBeenCalled();
  });

  it('rejects resend when target user is not approved', async () => {
    const admin = await seedUser(db, {
      email: 'admin@example.com',
      isApproved: true,
      isAdmin: true,
    });
    const target = await seedUser(db, {
      email: 'pending@example.com',
      isApproved: false,
      isAdmin: false,
    });
    const repository = new DrizzleUserAccessRepository(db);
    const inviteEmailService: InviteEmailService = {
      sendUserAddedInvite: vi.fn(async () => ({
        ok: true as const,
        providerMessageId: null,
      })),
    };

    const result = await sendUserAccessInvite(repository, inviteEmailService, {
      actorUserId: admin.id,
      targetUserId: target.id,
      loginUrl: 'http://localhost:3000/login',
    });

    expect(result).toEqual({ ok: false, error: 'User is not approved' });
    expect(inviteEmailService.sendUserAddedInvite).not.toHaveBeenCalled();
  });
});
