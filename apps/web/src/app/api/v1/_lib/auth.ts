import { eq } from 'drizzle-orm';
import { auth } from '@/infrastructure/auth';
import { db } from '@/infrastructure/db/client';
import { users } from '@/infrastructure/db/schema';
import { resolveAuthenticatedUserId } from '@/infrastructure/organization/resolve-authenticated-user';
import { isAnonymisedEmail } from './anonymised-email';
import { respondWithError } from './errors';

export type CookieSessionResult =
  | {
      readonly ok: true;
      readonly userId: string;
      readonly isApproved: boolean;
    }
  | {
      readonly ok: false;
      readonly response: Response;
    };

/**
 * Resolve the current cookie session for a v1 endpoint. Returns either a
 * typed user context or a pre-built error Response that the handler should
 * return directly.
 *
 * Branches:
 * - No session / user gone           → { ok: false, response: 401 unauthenticated }
 * - Anonymised user (ADR 031 marker) → { ok: false, response: 410 user_deleted }
 * - Authenticated user (any approval) → { ok: true, userId, isApproved }
 *
 * Slice 2 will introduce a `requireAuth()` that also accepts bearer tokens
 * and resolves to the same `User` row; this cookie-only helper stays focused.
 */
export async function requireCookieSession(): Promise<CookieSessionResult> {
  const session = await auth();
  const userId = await resolveAuthenticatedUserId(db, {
    id: session?.user?.id,
    email: session?.user?.email ?? null,
    name: session?.user?.name ?? null,
  });

  if (!userId) {
    return {
      ok: false,
      response: respondWithError('unauthenticated', 'No valid session.'),
    };
  }

  const rows = await db
    .select({ email: users.email, isApproved: users.isApproved })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const user = rows[0];
  if (!user) {
    return {
      ok: false,
      response: respondWithError('unauthenticated', 'No valid session.'),
    };
  }

  if (isAnonymisedEmail(user.email, userId)) {
    return {
      ok: false,
      response: respondWithError('user_deleted', 'This account has been deleted.'),
    };
  }

  return { ok: true, userId, isApproved: user.isApproved };
}
