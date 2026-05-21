import { mobileAuthStartRequestSchema as Body } from '@travel-planner/shared';
import { makeStartMobileAuth } from '@/application/use-cases/auth/mobile/start-mobile-auth';
import { getAppContainer } from '@/infrastructure/container';
import { respondWithError } from '../../../_lib/errors';
import { respondWithData } from '../../../_lib/respond';
import { buildMobileCallbackRedirectUri } from '../_lib/redirect-uri';
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
      endpoint: 'start',
      repo: container.authRateLimitRepository,
    });
    if (rateLimit) return rateLimit;

    const startMobileAuth = makeStartMobileAuth({
      stateRepo: container.mobileAuthStateRepository,
      google: container.googleOAuthClient,
      crypto: container.mobileAuthCrypto,
      redirectUri: buildMobileCallbackRedirectUri(request),
    });

    const result = await startMobileAuth({ codeChallenge: parsed.data.code_challenge }, new Date());

    return respondWithData(request, {
      authorise_url: result.authoriseUrl,
      state: result.state,
    });
  } catch (error) {
    console.error('[api/v1/auth/mobile/start] unexpected error', error);
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
