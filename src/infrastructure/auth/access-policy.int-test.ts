import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  decideSignInAccess,
  isUserAccessAdmin,
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
  it('denies unknown users', async () => {
    const decision = await decideSignInAccess(db, 'new@example.com');

    expect(decision).toEqual({
      allowed: false,
      seededAdmin: false,
    });
  });

  it('allows approved users', async () => {
    const user = await seedUser(db, {
      email: 'approved@example.com',
      isApproved: true,
      isAdmin: false,
    });
    const decision = await decideSignInAccess(db, user.email);

    expect(decision.allowed).toBe(true);
  });

  it('allows approved gmail users when googlemail alias is used at sign-in', async () => {
    await seedUser(db, {
      email: 'jane.doe@gmail.com',
      isApproved: true,
      isAdmin: false,
    });

    const decision = await decideSignInAccess(db, 'janedoe@googlemail.com');

    expect(decision.allowed).toBe(true);
    expect(decision.seededAdmin).toBe(false);
  });

  it('allows approved users even when stored email contains surrounding whitespace', async () => {
    await seedUser(db, {
      email: '  approved@example.com  ',
      isApproved: true,
      isAdmin: false,
    });

    const decision = await decideSignInAccess(db, 'approved@example.com');

    expect(decision.allowed).toBe(true);
  });

  it('denies unapproved users', async () => {
    const user = await seedUser(db, {
      email: 'blocked@example.com',
      isApproved: false,
      isAdmin: false,
    });

    const decision = await decideSignInAccess(db, user.email);
    expect(decision.allowed).toBe(false);
  });

  it('treats local-dev credentials user as bootstrap admin when local dev auth is enabled', async () => {
    const localDevUser = await seedUser(db, {
      email: 'local-dev@travel-planner.local',
      isApproved: false,
      isAdmin: false,
    });

    const decision = await decideSignInAccess(db, localDevUser.email, {
      NODE_ENV: 'production',
      AUTH_ENABLE_LOCAL_DEV: 'true',
    });

    expect(decision).toEqual({
      allowed: true,
      seededAdmin: true,
    });

    await syncSeedAdminAccessByUserId(db, localDevUser.id, {
      NODE_ENV: 'production',
      AUTH_ENABLE_LOCAL_DEV: 'true',
    });

    const isAdmin = await isUserAccessAdmin(db, localDevUser.id, {
      NODE_ENV: 'production',
      AUTH_ENABLE_LOCAL_DEV: 'true',
    });
    expect(isAdmin).toBe(true);
  });

  it('cuts off revoked users on next request', async () => {
    const revokedUser = await seedUser(db, {
      email: 'revoked@example.com',
      isApproved: false,
      isAdmin: false,
    });

    const allowed = await isUserAllowedForApp(db, revokedUser.id);

    expect(allowed).toBe(false);
  });
});
