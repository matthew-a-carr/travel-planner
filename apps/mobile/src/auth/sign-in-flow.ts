import {
  type MeResponse,
  type MobileAuthExchangeResponse,
  type MobileAuthStartResponse,
  meResponseSchema,
  mobileAuthCallbackErrorSchema,
  mobileAuthExchangeResponseSchema,
  mobileAuthStartResponseSchema,
} from '@travel-planner/shared';
import type * as WebBrowser from 'expo-web-browser';
import type { apiGet, apiPost } from '../api/client';
import type { storeTokens } from './keychain';
import type { generateVerifier, verifierToChallenge } from './pkce';

/**
 * Orchestrates the five-step mobile sign-in flow (SPEC-006 §7):
 *
 *   1. Generate PKCE verifier + challenge on-device.
 *   2. POST /api/v1/auth/mobile/start with the challenge.
 *   3. openAuthSessionAsync(authorise_url, 'travelplanner://auth')
 *      → await the deep-link return.
 *   4. POST /api/v1/auth/mobile/exchange with the one-time code +
 *      verifier.
 *   5. GET /api/v1/me with the new bearer **as proof** the token
 *      round-trips. Only then storeTokens(); on /me failure, no
 *      partial state lands in Keychain.
 *
 * Dependencies are injected so tests can mock each boundary surface
 * (HTTP, browser, crypto, keychain) without touching orchestration
 * logic.
 */

export type SignInResult =
  | { status: 'success'; email: string }
  | { status: 'cancelled' }
  | { status: 'error'; reason: 'access_denied' | 'generic'; code: string };

export type SignInDeps = {
  apiPost: typeof apiPost;
  apiGet: typeof apiGet;
  openAuthSession: typeof WebBrowser.openAuthSessionAsync;
  generateVerifier: typeof generateVerifier;
  verifierToChallenge: typeof verifierToChallenge;
  storeTokens: typeof storeTokens;
};

const CALLBACK_RETURN_URL = 'travelplanner://auth';
const UNKNOWN_CALLBACK_ERROR_CODE = 'unknown_callback_error';
const NO_CODE_IN_CALLBACK_CODE = 'no_code_in_callback';

export async function runSignInFlow(deps: SignInDeps): Promise<SignInResult> {
  // 1. PKCE pair.
  const verifier = await deps.generateVerifier();
  const challenge = await deps.verifierToChallenge(verifier);

  // 2. /start.
  const start = await deps.apiPost<MobileAuthStartResponse>(
    '/api/v1/auth/mobile/start',
    { code_challenge: challenge },
    mobileAuthStartResponseSchema,
  );
  if (!start.ok) return genericError(start.error.code);

  // 3. Browser modal — awaits the deep-link return.
  const browserResult = await deps.openAuthSession(start.data.authorise_url, CALLBACK_RETURN_URL);
  if (browserResult.type !== 'success') return { status: 'cancelled' };

  // 4. Parse deep-link return — either ?code=<one-time> or ?error=<reason>.
  const params = parseDeepLink(browserResult.url);
  if (params.error !== undefined) {
    const parsedError = mobileAuthCallbackErrorSchema.safeParse(params.error);
    if (parsedError.success) {
      if (parsedError.data === 'access_denied') {
        return { status: 'error', reason: 'access_denied', code: 'access_denied' };
      }
      return { status: 'error', reason: 'generic', code: parsedError.data };
    }
    return { status: 'error', reason: 'generic', code: UNKNOWN_CALLBACK_ERROR_CODE };
  }
  if (params.code === undefined) {
    return { status: 'error', reason: 'generic', code: NO_CODE_IN_CALLBACK_CODE };
  }

  // 5. /exchange.
  const exchange = await deps.apiPost<MobileAuthExchangeResponse>(
    '/api/v1/auth/mobile/exchange',
    { code: params.code, code_verifier: verifier },
    mobileAuthExchangeResponseSchema,
  );
  if (!exchange.ok) return genericError(exchange.error.code);

  // 6. /me — proof of bearer. No persistence until this succeeds.
  const me = await deps.apiGet<MeResponse>(
    '/api/v1/me',
    meResponseSchema,
    exchange.data.access_token,
  );
  if (!me.ok) return genericError(me.error.code);

  // 7. Persist + done.
  await deps.storeTokens(exchange.data);
  return { status: 'success', email: me.data.email };
}

function parseDeepLink(url: string): { code?: string; error?: string } {
  const queryStart = url.indexOf('?');
  if (queryStart === -1) return {};
  const params = new URLSearchParams(url.slice(queryStart + 1));
  return {
    code: params.get('code') ?? undefined,
    error: params.get('error') ?? undefined,
  };
}

function genericError(code: string): SignInResult {
  return { status: 'error', reason: 'generic', code };
}
