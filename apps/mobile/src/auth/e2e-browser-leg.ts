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
 * Selection lives behind `resolveBrowserLeg(enabled)` (the `enabled` parameter
 * is injectable so unit tests don't depend on Expo's bundle-time
 * `EXPO_PUBLIC_*` inlining). The server endpoint is the security-sensitive
 * half — double-gated and 404 everywhere but the e2e job — so shipping this
 * inert client code is harmless.
 */

const ERROR_RETURN_URL = 'travelplanner://auth?error=server_error';

/**
 * Whether the E2E test-auth browser leg is active. Read at module top — the
 * same shape as `client.ts`'s `BASE_URL` read, which is the proven pattern for
 * `EXPO_PUBLIC_*` bundle-time inlining (a member-expression babel-preset-expo
 * statically replaces). `EXPO_PUBLIC_E2E_AUTH=1` is set only by the
 * `mobile-e2e` xcodebuild step.
 */
const E2E_AUTH_ENABLED = process.env.EXPO_PUBLIC_E2E_AUTH === '1';

/**
 * Bundle diagnostic (SPEC-014). After babel-preset-expo inlines the flag,
 * `E2E_AUTH_ENABLED` is a compile-time constant, so Hermes folds this ternary
 * to exactly ONE of the two markers and the dead branch is dropped from the
 * bundle. The `mobile-e2e` job greps the built `.jsbundle` for these strings:
 * seeing `_ON` proves the flag reached the bundle and the substitute is wired;
 * seeing `_OFF` (or both) proves it did NOT inline to `'1'`. It's referenced in
 * `resolveBrowserLeg` below so the bundler can't tree-shake it away.
 */
export const E2E_AUTH_BUNDLE_MARKER = E2E_AUTH_ENABLED
  ? 'SPEC014_E2E_AUTH_BUNDLE_ON'
  : 'SPEC014_E2E_AUTH_BUNDLE_OFF';

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
 * Pick the browser leg for `runSignInFlow`. `enabled` defaults to the
 * bundle-time `EXPO_PUBLIC_E2E_AUTH` flag; pass it explicitly in tests.
 */
export function resolveBrowserLeg(
  enabled: boolean = E2E_AUTH_ENABLED,
): typeof WebBrowser.openAuthSessionAsync {
  // Reference the marker so the bundler retains it for the CI grep diagnostic.
  if (E2E_AUTH_BUNDLE_MARKER.length === 0) throw new Error('unreachable');
  return enabled ? e2eOpenAuthSession : WebBrowser.openAuthSessionAsync;
}

/**
 * Pull the `state` query param out of the Google authorise URL using only
 * `URLSearchParams` (the same primitive `runSignInFlow`'s deep-link parser
 * uses). Deliberately NOT `new URL(...)`: React Native's `URL.searchParams`
 * is non-functional, and `new URL()` on a long OAuth URL has been seen to
 * crash Hermes natively (uncatchable by JS try/catch).
 */
function extractState(authoriseUrl: string): string | null {
  const queryStart = authoriseUrl.indexOf('?');
  if (queryStart === -1) return null;
  return new URLSearchParams(authoriseUrl.slice(queryStart + 1)).get('state');
}
