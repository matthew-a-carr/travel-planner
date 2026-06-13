import { mobileAuthTestTokenRequestSchema as Body } from '@travel-planner/shared';
import { makeMintTestExchangeCode } from '@/application/use-cases/auth/mobile/mint-test-exchange-code';
import { getAppContainer } from '@/infrastructure/container';
import { E2E_FIXTURES } from '@/infrastructure/db/seed/e2e-fixtures';
import { respondWithError } from '../../../_lib/errors';
import { respondWithData } from '../../../_lib/respond';

/**
 * **Test-only** auth seam (SPEC-014, EPIC-004 slice 2). Replaces only the
 * browser leg of the mobile PKCE flow so CI can sign in without Google: given
 * a live `state` from `/start`, it mints a one-time exchange code for a seeded
 * approved user keyed to that state's stored challenge (see
 * `mint-test-exchange-code`). The substitute browser leg in the E2E app build
 * (`apps/mobile/src/auth/e2e-browser-leg.ts`) calls this and feeds the
 * returned deep link back into the real `/exchange`.
 *
 * **Double-gated, fail-closed** (ADR 060 §10): the endpoint is invisible (404)
 * unless `E2E_TEST_AUTH === '1'` AND the process is not on Vercel. Both gates
 * are evaluated per request so the route int-test can toggle them between
 * cases. The flags live only in `ci.yml` — never in Terraform / Vercel env /
 * `.env*`. AC3 (404 when unset) is EPIC-004's literal kill-criterion proof.
 *
 * Deliberately **not** published to OpenAPI (`scripts/generate-openapi.ts`):
 * it's a test backdoor, not a product contract.
 */

function seamEnabled(): boolean {
  const flagOn = process.env.E2E_TEST_AUTH === '1';
  const onVercel = (process.env.VERCEL ?? '').trim() === '1';
  return flagOn && !onVercel;
}

export async function POST(request: Request): Promise<Response> {
  // Gate first — no body parsing, no DB access when disabled. 404 makes the
  // route indistinguishable from one that doesn't exist.
  if (!seamEnabled()) {
    return respondWithError(request, 'not_found', { detail: 'Not found.' });
  }

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
    const mintTestExchangeCode = makeMintTestExchangeCode({
      stateRepo: container.mobileAuthStateRepository,
      exchangeCodeRepo: container.mobileAuthExchangeCodeRepository,
      userAccessRepo: container.userAccessRepository,
      crypto: container.mobileAuthCrypto,
    });

    const result = await mintTestExchangeCode(
      {
        state: parsed.data.state,
        email: parsed.data.email ?? E2E_FIXTURES.user.email,
      },
      new Date(),
    );

    return respondWithData(request, { redirect_url: result.redirectUrl });
  } catch (error) {
    console.error('[api/v1/auth/mobile/test-token] unexpected error', error);
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
