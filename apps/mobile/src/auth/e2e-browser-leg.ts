import { mobileAuthTestTokenResponseSchema } from '@travel-planner/shared';
import * as WebBrowser from 'expo-web-browser';
import { apiPost } from '../api/client';

/**
 * E2E test-auth seam — **client half** (SPEC-014, EPIC-004 slice 2).
 *
 * `runSignInFlow(deps)` injects the browser leg as `deps.openAuthSession`.
 * In a normal build that's `WebBrowser.openAuthSessionAsync` (opens Google in
 * the system browser). In the E2E app build (`EXPO_PUBLIC_E2E_AUTH=1` inlined
 * at bundle time) it's the substitute below, which calls the server's gated
 * `/api/v1/auth/mobile/test-token` and returns the deep link — so PKCE start,
 * `/exchange`, Keychain, `/me`, and AuthGuard all still run for real. Only the
 * human-at-Google step is replaced.
 *
 * Selection lives behind `resolveBrowserLeg(flag)` (the `flag` parameter is
 * injectable so unit tests don't depend on Expo's bundle-time `EXPO_PUBLIC_*`
 * inlining). The server endpoint is the security-sensitive half — double-gated
 * and 404 everywhere but the e2e job — so shipping this inert client code is
 * harmless.
 */

const ERROR_RETURN_URL = 'travelplanner://auth?error=server_error';

/**
 * Substitute for `WebBrowser.openAuthSessionAsync`. Extracts the `state` from
 * the Google authorise URL, asks the server to mint a one-time exchange code
 * for the seeded e2e user, and returns the resulting deep link as a `success`
 * result. Any failure returns a `?error=server_error` deep link so the flow
 * surfaces a loud error rather than hanging — a broken seam must look like a
 * failure, never like a user cancelling.
 */
export const e2eOpenAuthSession: typeof WebBrowser.openAuthSessionAsync = async (authoriseUrl) => {
  const state = extractState(authoriseUrl);
  if (state === null) {
    return { type: 'success', url: ERROR_RETURN_URL };
  }

  const result = await apiPost(
    '/api/v1/auth/mobile/test-token',
    { state },
    mobileAuthTestTokenResponseSchema,
  );
  if (!result.ok) {
    return { type: 'success', url: ERROR_RETURN_URL };
  }

  return { type: 'success', url: result.data.redirect_url };
};

/**
 * Pick the browser leg for `runSignInFlow`. `flag` defaults to the bundle-time
 * `EXPO_PUBLIC_E2E_AUTH` env; pass it explicitly in tests.
 */
export function resolveBrowserLeg(
  flag: string | undefined = process.env.EXPO_PUBLIC_E2E_AUTH,
): typeof WebBrowser.openAuthSessionAsync {
  return flag === '1' ? e2eOpenAuthSession : WebBrowser.openAuthSessionAsync;
}

function extractState(authoriseUrl: string): string | null {
  try {
    return new URL(authoriseUrl).searchParams.get('state');
  } catch {
    const queryStart = authoriseUrl.indexOf('?');
    if (queryStart === -1) return null;
    return new URLSearchParams(authoriseUrl.slice(queryStart + 1)).get('state');
  }
}
