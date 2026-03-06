import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  decideSignInAccess,
  isUserAllowedForApp,
  syncSeedAdminAccessByUserId,
} from '@/infrastructure/auth/access-policy';
import {
  createTestDb,
  type Db,
  type Sql,
  seedUser,
  truncateAll,
} from '@/infrastructure/testing/helpers';

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

describe('access-policy integration', () => {
  it('denies unknown users when self-registration is disabled', async () => {
    const decision = await decideSignInAccess(db, 'new@example.com', {
      AUTH_SELF_REGISTRATION_ENABLED: 'false',
      AUTH_ADMIN_EMAILS: 'admin@example.com',
    });

    expect(decision).toEqual({
      allowed: false,
      seededAdmin: false,
      autoApprove: false,
    });
  });

  it('allows approved users when self-registration is disabled', async () => {
    const user = await seedUser(db, {
      email: 'approved@example.com',
      isApproved: true,
      isAdmin: false,
    });
    const decision = await decideSignInAccess(db, user.email, {
      AUTH_SELF_REGISTRATION_ENABLED: 'false',
      AUTH_ADMIN_EMAILS: '',
    });

    expect(decision.allowed).toBe(true);
    expect(decision.autoApprove).toBe(false);
  });

  it('allows configured admin emails and syncs admin flags', async () => {
    const admin = await seedUser(db, {
      email: 'admin@example.com',
      isApproved: false,
      isAdmin: false,
    });

    const decision = await decideSignInAccess(db, admin.email, {
      AUTH_SELF_REGISTRATION_ENABLED: 'false',
      AUTH_ADMIN_EMAILS: 'admin@example.com',
    });
    expect(decision.allowed).toBe(true);
    expect(decision.seededAdmin).toBe(true);

    await syncSeedAdminAccessByUserId(db, admin.id, {
      AUTH_SELF_REGISTRATION_ENABLED: 'false',
      AUTH_ADMIN_EMAILS: 'admin@example.com',
    });

    const allowed = await isUserAllowedForApp(db, admin.id, {
      AUTH_SELF_REGISTRATION_ENABLED: 'false',
      AUTH_ADMIN_EMAILS: 'admin@example.com',
    });
    expect(allowed).toBe(true);
  });

  it('cuts off revoked users on next request when self-registration is disabled', async () => {
    const revokedUser = await seedUser(db, {
      email: 'revoked@example.com',
      isApproved: false,
      isAdmin: false,
    });

    const allowed = await isUserAllowedForApp(db, revokedUser.id, {
      AUTH_SELF_REGISTRATION_ENABLED: 'false',
      AUTH_ADMIN_EMAILS: '',
    });

    expect(allowed).toBe(false);
  });
});
