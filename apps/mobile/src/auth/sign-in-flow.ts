import {
  type MobileAuthExchangeResponse,
  type MobileAuthStartResponse,
  mobileAuthCallbackErrorSchema,
  mobileAuthExchangeResponseSchema,
  mobileAuthStartResponseSchema,
} from '@travel-planner/shared';
import type * as WebBrowser from 'expo-web-browser';
import type { apiPost } from '../api/client';
import type { generateVerifier, verifierToChallenge } from './pkce';

/**
 * Orchestrates the four-step mobile sign-in flow (SPEC-007 §7.3 —
 * reshape of SPEC-006's five-step flow; /me + storeTokens move to
 * AuthProvider.signIn so there's a single owner of "who is the
 * current user"):
 *
 *   1. Generate PKCE verifier + challenge on-device.
 *   2. POST /api/v1/auth/mobile/start with the challenge.
 *   3. openAuthSessionAsync(authorise_url, 'travelplanner://auth')
 *      → await the deep-link return.
 *   4. POST /api/v1/auth/mobile/exchange with the one-time code +
 *      verifier → return the mint pair.
 *
 * No /me call here, no Keychain write. The caller (sign-in screen)
 * hands the returned tokens to AuthProvider.signIn(tokens), which
 * persists them, fetches /me, and transitions the auth state. If
 * /me fails post-exchange, AuthProvider clears Keychain — same
 * end state as slice 6, just owned by the AuthProvider instead of
 * the flow.
 *
 * Dependencies are injected so tests can mock each boundary surface
 * (HTTP, browser, crypto) without touching orchestration logic.
 */

export type SignInResult =
  | { status: 'success'; tokens: MobileAuthExchangeResponse }
  | { status: 'cancelled' }
  | { status: 'error'; reason: 'access_denied' | 'generic'; code: string };

export type SignInDeps = {
  apiPost: typeof apiPost;
  openAuthSession: typeof WebBrowser.openAuthSessionAsync;
  generateVerifier: typeof generateVerifier;
  verifierToChallenge: typeof verifierToChallenge;
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

  return { status: 'success', tokens: exchange.data };
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
