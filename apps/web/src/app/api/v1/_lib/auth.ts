import { eq } from 'drizzle-orm';
import { auth } from '@/infrastructure/auth';
import { verifyAccessToken } from '@/infrastructure/auth/bearer-token';
import { db } from '@/infrastructure/db/client';
import { users } from '@/infrastructure/db/schema';
import { resolveAuthenticatedUserId } from '@/infrastructure/organization/resolve-authenticated-user';
import { isAnonymisedEmail } from './anonymised-email';
import { respondWithError } from './errors';

export type AuthResult =
  | {
      readonly ok: true;
      readonly userId: string;
      readonly email: string;
      readonly name: string | null;
      readonly isApproved: boolean;
    }
  | {
      readonly ok: false;
      readonly response: Response;
    };

/**
 * Resolve the current cookie session for a v1 endpoint. See `requireAuth`
 * for the credential-agnostic version most handlers should use.
 *
 * Branches:
 * - No session / user gone           → { ok: false, response: 401 unauthenticated }
 * - Anonymised user (ADR 031 marker) → { ok: false, response: 410 user_deleted }
 * - Authenticated user (any approval) → { ok: true, userId, email, name, isApproved }
 */
export async function requireCookieSession(): Promise<AuthResult> {
  const session = await auth();
  const userId = await resolveAuthenticatedUserId(db, {
    id: session?.user?.id,
    email: session?.user?.email ?? null,
    name: session?.user?.name ?? null,
  });

  if (!userId) return unauthenticated();
  return resolveUserRow(userId);
}

/**
 * Resolve a bearer-token session for a v1 endpoint. Reads the
 * `Authorization: Bearer <jwt>` header; collapses every verification
 * failure to 401 unauthenticated per ADR 051. Successful verification
 * resolves the JWT's `sub` to the same user-row branches the cookie
 * path uses.
 */
export async function requireBearerSession(request: Request): Promise<AuthResult> {
  const header = request.headers.get('authorization');
  const jwt = extractBearerToken(header);
  if (jwt === null) return unauthenticated();

  const verified = await verifyAccessToken(jwt);
  if (!verified.ok) {
    console.warn('[api/v1/auth] bearer verification failed', { reason: verified.error });
    return unauthenticated();
  }

  return resolveUserRow(verified.value.userId);
}

/**
 * Cookie OR bearer auth. The default for authenticated /api/v1/*
 * endpoints. Bearer wins when both are present (per ADR 051 / the
 * conventions doc).
 */
export async function requireAuth(request: Request): Promise<AuthResult> {
  const header = request.headers.get('authorization');
  if (header?.toLowerCase().startsWith('bearer ')) {
    return requireBearerSession(request);
  }
  return requireCookieSession();
}

function extractBearerToken(header: string | null): string | null {
  if (!header) return null;
  if (!header.toLowerCase().startsWith('bearer ')) return null;
  const token = header.slice('bearer '.length).trim();
  return token.length > 0 ? token : null;
}

async function resolveUserRow(userId: string): Promise<AuthResult> {
  const rows = await db
    .select({
      email: users.email,
      name: users.name,
      isApproved: users.isApproved,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const user = rows[0];
  if (!user) return unauthenticated();

  if (isAnonymisedEmail(user.email, userId)) {
    return {
      ok: false,
      response: respondWithError('user_deleted', 'This account has been deleted.'),
    };
  }

  return {
    ok: true,
    userId,
    email: user.email,
    name: user.name,
    isApproved: user.isApproved,
  };
}

function unauthenticated(): AuthResult {
  return {
    ok: false,
    response: respondWithError('unauthenticated', 'No valid session.'),
  };
}
