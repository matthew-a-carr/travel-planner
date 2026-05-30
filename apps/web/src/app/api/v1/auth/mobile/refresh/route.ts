import * as Sentry from '@sentry/nextjs';
import { mobileAuthRefreshRequestSchema as Body } from '@travel-planner/shared';
import { makeRefreshMobileTokens } from '@/application/use-cases/auth/mobile/refresh-mobile-tokens';
import { getAppContainer } from '@/infrastructure/container';
import { respondWithError } from '../../../_lib/errors';
import { respondWithData } from '../../../_lib/respond';
import { rateLimitOrReject } from '../_lib/with-rate-limit';

export async function POST(request: Request): Promise<Response> {
  try {
    const parsed = Body.safeParse(await safeJson(request));
    if (!parsed.success) {
      return respondWithError(request, 'validation_failed', {
        detail: 'Invalid request body.',
        details: {
          issues: parsed.error.issues.map((i) => ({ path: i.path, message: i.message })),
        },
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
          return respondWithError(request, 'refresh_reused', {
            detail: 'Refresh token was reused; the chain has been revoked.',
          });
        case 'refresh_expired':
          return respondWithError(request, 'refresh_expired', {
            detail: 'Refresh token has expired.',
          });
        case 'refresh_revoked':
          return respondWithError(request, 'refresh_revoked', {
            detail: 'Refresh token was revoked.',
          });
        case 'refresh_unknown':
          return respondWithError(request, 'refresh_unknown', {
            detail: 'Refresh token is unknown.',
          });
      }
    }

    return respondWithData(request, {
      access_token: result.value.accessToken,
      refresh_token: result.value.refreshToken,
      access_expires_at: result.value.accessExpiresAt.toISOString(),
    });
  } catch (error) {
    console.error('[api/v1/auth/mobile/refresh] unexpected error', error);
    return respondWithError(request, 'internal', { detail: 'An unexpected error occurred.' });
  }
}

async function safeJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}
