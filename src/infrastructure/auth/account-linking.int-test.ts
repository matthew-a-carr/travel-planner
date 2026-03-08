/**
 * Integration tests for the OAuth account-linking behaviour.
 *
 * These tests cover the scenario that caused the OAuthAccountNotLinked error
 * in production:
 *
 *   An admin pre-seeds a user in the `users` table (sets isApproved = true).
 *   The user then tries to sign in with Google for the first time.
 *   Auth.js finds the existing users row by email but finds no matching row in
 *   the accounts table, which normally triggers OAuthAccountNotLinked.
 *
 * The fix — `allowDangerousEmailAccountLinking: true` on the Google provider —
 * makes Auth.js call `getUserByEmail` and link the OAuth account to the
 * existing user rather than rejecting the sign-in.
 *
 * These tests verify the access-policy and adapter layers that Auth.js calls
 * during that linking flow, confirming the data model supports the scenario
 * end-to-end.
 */

import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { decideSignInAccess } from '@/infrastructure/auth/access-policy';
import * as schema from '@/infrastructure/db/schema';
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function linkOAuthAccount(
  db: Db,
  userId: string,
  opts: { provider?: string; providerAccountId?: string } = {},
): Promise<void> {
  await db.insert(schema.accounts).values({
    userId,
    type: 'oauth',
    provider: opts.provider ?? 'google',
    providerAccountId: opts.providerAccountId ?? `google-sub-${userId}`,
    access_token: 'test-access-token',
    scope: 'openid email profile',
    token_type: 'bearer',
  });
}

async function getLinkedAccounts(db: Db, userId: string) {
  return db
    .select()
    .from(schema.accounts)
    .where(eq(schema.accounts.userId, userId));
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('pre-seeded user OAuth account linking', () => {
  it('allows an approved pre-seeded user to pass the access-policy gate before their OAuth account is linked', async () => {
    // This is the state immediately after an admin creates the user but before
    // the user's first Google sign-in: users row exists, accounts row does not.
    const user = await seedUser(db, {
      email: 'mc12405@my.bristol.ac.uk',
      isApproved: true,
      isAdmin: false,
    });

    // No accounts row exists yet — this is what triggers OAuthAccountNotLinked
    // in Auth.js when allowDangerousEmailAccountLinking is NOT set.
    const linkedAccounts = await getLinkedAccounts(db, user.id);
    expect(linkedAccounts).toHaveLength(0);

    // The access-policy must still allow sign-in based on the users row alone.
    const decision = await decideSignInAccess(db, user.email);
    expect(decision.allowed).toBe(true);
    expect(decision.seededAdmin).toBe(false);
  });

  it('allows an approved pre-seeded user to pass the access-policy gate after their OAuth account is linked', async () => {
    // This is the state after a successful first sign-in: both rows exist.
    const user = await seedUser(db, {
      email: 'mc12405@my.bristol.ac.uk',
      isApproved: true,
      isAdmin: false,
    });

    await linkOAuthAccount(db, user.id, {
      providerAccountId: 'google-sub-mc12405',
    });

    const linkedAccounts = await getLinkedAccounts(db, user.id);
    expect(linkedAccounts).toHaveLength(1);
    expect(linkedAccounts[0]?.provider).toBe('google');

    const decision = await decideSignInAccess(db, user.email);
    expect(decision.allowed).toBe(true);
  });

  it('denies a pre-seeded but unapproved user regardless of whether an OAuth account is linked', async () => {
    const user = await seedUser(db, {
      email: 'pending@my.bristol.ac.uk',
      isApproved: false,
      isAdmin: false,
    });

    // Even if an accounts row exists the access-policy must reject unapproved users.
    await linkOAuthAccount(db, user.id);

    const decision = await decideSignInAccess(db, user.email);
    expect(decision.allowed).toBe(false);
  });

  it('denies a completely unknown user who has no users row at all', async () => {
    // No users row — the user attempted to register themselves, which is not allowed.
    const decision = await decideSignInAccess(db, 'unknown@my.bristol.ac.uk');
    expect(decision.allowed).toBe(false);
    expect(decision.seededAdmin).toBe(false);
  });

  it('supports multiple OAuth providers linked to the same pre-seeded user', async () => {
    const user = await seedUser(db, {
      email: 'multi-provider@example.com',
      isApproved: true,
      isAdmin: false,
    });

    await linkOAuthAccount(db, user.id, { provider: 'google', providerAccountId: 'gid-1' });
    await linkOAuthAccount(db, user.id, { provider: 'github', providerAccountId: 'ghid-1' });

    const linkedAccounts = await getLinkedAccounts(db, user.id);
    expect(linkedAccounts).toHaveLength(2);

    // Access policy still works correctly with multiple linked accounts.
    const decision = await decideSignInAccess(db, user.email);
    expect(decision.allowed).toBe(true);
  });

  it('correctly resolves a pre-seeded university email that is not subject to Gmail normalisation', async () => {
    // University addresses (non-Gmail domains) must match exactly.
    // Regression guard: ensure normalizeEmail does not mangle non-Gmail addresses.
    await seedUser(db, {
      email: 'mc12405@my.bristol.ac.uk',
      isApproved: true,
    });

    // Exact match should be allowed.
    const exactMatch = await decideSignInAccess(db, 'mc12405@my.bristol.ac.uk');
    expect(exactMatch.allowed).toBe(true);

    // Capitalisation differences should still match (normalisation lowercases).
    const upperMatch = await decideSignInAccess(db, 'MC12405@MY.BRISTOL.AC.UK');
    expect(upperMatch.allowed).toBe(true);

    // A different email on the same domain must be rejected.
    const differentUser = await decideSignInAccess(db, 'zz99999@my.bristol.ac.uk');
    expect(differentUser.allowed).toBe(false);
  });
});
