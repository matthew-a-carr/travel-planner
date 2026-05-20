import * as Sentry from '@sentry/nextjs';
import { mobileAuthRefreshRequestSchema as Body } from '@travel-planner/shared';
import { makeRefreshMobileTokens } from '@/application/use-cases/auth/mobile/refresh-mobile-tokens';
import { getAppContainer } from '@/infrastructure/container';
import { respondWithError } from '../../../_lib/errors';
import { rateLimitOrReject } from '../_lib/with-rate-limit';

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
      endpoint: 'refresh',
      repo: container.authRateLimitRepository,
    });
    if (rateLimit) return rateLimit;

    const refreshMobileTokens = makeRefreshMobileTokens({
      refreshTokenRepo: container.refreshTokenRepository,
      crypto: container.mobileAuthCrypto,
      onChainRevoked: ({ userId, chainIds }) => {
        Sentry.captureMessage('auth.refresh.chain_revoked', {
          level: 'warning',
          tags: { feature: 'mobile-auth', event: 'auth.refresh.chain_revoked' },
          extra: { userId, chainLength: chainIds.length },
        });
      },
    });

    const result = await refreshMobileTokens(
      { refreshToken: parsed.data.refresh_token },
      new Date(),
    );

    if (!result.ok) {
      switch (result.error) {
        case 'refresh_reused':
          return respondWithError(
            'refresh_reused',
            'Refresh token was reused; the chain has been revoked.',
          );
        case 'refresh_expired':
          return respondWithError('refresh_expired', 'Refresh token has expired.');
        case 'refresh_revoked':
          return respondWithError('refresh_revoked', 'Refresh token was revoked.');
        case 'refresh_unknown':
          return respondWithError('refresh_unknown', 'Refresh token is unknown.');
      }
    }

    return Response.json(
      {
        access_token: result.value.accessToken,
        refresh_token: result.value.refreshToken,
        access_expires_at: result.value.accessExpiresAt.toISOString(),
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    console.error('[api/v1/auth/mobile/refresh] unexpected error', error);
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
