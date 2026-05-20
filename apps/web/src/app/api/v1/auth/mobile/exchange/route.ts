import { mobileAuthExchangeRequestSchema as Body } from '@travel-planner/shared';
import { makeExchangeMobileCode } from '@/application/use-cases/auth/mobile/exchange-mobile-code';
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
      endpoint: 'exchange',
      repo: container.authRateLimitRepository,
    });
    if (rateLimit) return rateLimit;

    const exchangeMobileCode = makeExchangeMobileCode({
      exchangeCodeRepo: container.mobileAuthExchangeCodeRepository,
      refreshTokenRepo: container.refreshTokenRepository,
      crypto: container.mobileAuthCrypto,
    });

    const result = await exchangeMobileCode(
      { code: parsed.data.code, codeVerifier: parsed.data.code_verifier },
      new Date(),
    );

    if (!result.ok) {
      switch (result.error) {
        case 'invalid_exchange_code':
          return respondWithError(
            'invalid_exchange_code',
            'Exchange code is unknown, already used, or expired.',
          );
        case 'pkce_mismatch':
          return respondWithError(
            'pkce_mismatch',
            'The supplied code_verifier does not match the stored code_challenge.',
          );
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
    console.error('[api/v1/auth/mobile/exchange] unexpected error', error);
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
