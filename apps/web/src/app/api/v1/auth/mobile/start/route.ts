import { mobileAuthStartRequestSchema as Body } from '@travel-planner/shared';
import { makeStartMobileAuth } from '@/application/use-cases/auth/mobile/start-mobile-auth';
import { getAppContainer } from '@/infrastructure/container';
import { respondWithError } from '../../../_lib/errors';
import { buildMobileCallbackRedirectUri } from '../_lib/redirect-uri';
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

    return Response.json(
      { authorise_url: result.authoriseUrl, state: result.state },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    console.error('[api/v1/auth/mobile/start] unexpected error', error);
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
