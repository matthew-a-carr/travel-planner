import { mobileAuthRevokeRequestSchema as Body } from '@travel-planner/shared';
import { makeRevokeMobileTokens } from '@/application/use-cases/auth/mobile/revoke-mobile-tokens';
import { getAppContainer } from '@/infrastructure/container';
import { respondWithError } from '../../../_lib/errors';
import { rateLimitOrReject } from '../_lib/with-rate-limit';

/**
 * POST /api/v1/auth/mobile/revoke — sign-out from a mobile client.
 *
 * Marks the presented (active head) refresh-token row as `revoked_at = now`.
 * Predecessor rows in the chain are NOT touched here; any later reuse
 * fires reuse-detection in /refresh (ADR 054) and revokes the rest of
 * the chain.
 *
 * Returns 204 No Content unconditionally for valid inputs — the
 * endpoint promises "if you had a token, it's revoked now" rather
 * than confirming token existence. Unknown / already-revoked / valid
 * tokens all collapse to 204 so the endpoint can't be used to probe
 * which refresh tokens are live.
 */
export async function POST(request: Request): Promise<Response> {
  try {
    const parsed = Body.safeParse(await safeJson(request));
    if (!parsed.success) {
      return respondWithError('validation_failed', 'Invalid request body.', {
        issues: parsed.error.issues.map((i) => ({ path: i.path, message: i.message })),
      });
    }

    const container = getAppContainer();

    const rateLimit = await rateLimitOrReject({
      request,
      endpoint: 'revoke',
      repo: container.authRateLimitRepository,
    });
    if (rateLimit) return rateLimit;

    const revoke = makeRevokeMobileTokens({
      refreshTokenRepo: container.refreshTokenRepository,
      crypto: container.mobileAuthCrypto,
    });

    await revoke({ refreshToken: parsed.data.refresh_token }, new Date());

    return new Response(null, {
      status: 204,
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    console.error('[api/v1/auth/mobile/revoke] unexpected error', error);
    return respondWithError('internal', 'An unexpected error occurred.');
  }
}

async function safeJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}
