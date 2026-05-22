/**
 * Proactive refresh + single-flight access token gateway.
 *
 * Every authenticated `/api/v1/*` call from the mobile app routes
 * through this function to obtain its bearer. The flow:
 *
 * 1. Read the Keychain bundle.
 * 2. If no bundle → `{ ok: false, reason: 'no_tokens' }`.
 * 3. If `now < access_expires_at - 60s` → return the stored access
 *    token verbatim. No /refresh call.
 * 4. Otherwise call `POST /api/v1/auth/mobile/refresh`. On success,
 *    persist the new pair and return the new access token. On
 *    failure, clear Keychain and return `{ ok: false, reason: 'refresh_failed' }`.
 *
 * The 60-second buffer is generous-but-not-excessive headroom for
 * mobile clock skew (access tokens are 15 minutes; 1 minute of
 * defensive refresh is the right scale).
 *
 * Single-flight: if a /refresh is in flight when a second caller
 * arrives, both callers receive the same in-flight promise. This
 * matters because reuse-detection (ADR 054) revokes the entire
 * chain on a duplicate refresh — two parallel /refresh calls with
 * the same refresh_token would surprise-sign-out the user.
 * Slice 7 only fires `/me`-then-done so the race doesn't visibly
 * bite, but slice 8+ inherits the safe pattern.
 *
 * React Strict Mode's double-mount in dev is covered by the same
 * mutex: both effect-mounts share the same promise slot.
 */

import { mobileAuthRefreshResponseSchema } from '@travel-planner/shared';
import { apiPost } from '../api/client';
import { clearTokens, readTokens, storeTokens } from './keychain';

const REFRESH_BUFFER_MS = 60_000;

export type AccessTokenResult =
  | { ok: true; token: string }
  | { ok: false; reason: 'no_tokens' | 'refresh_failed' };

let inFlightRefresh: Promise<AccessTokenResult> | null = null;

export async function getAccessToken(): Promise<AccessTokenResult> {
  const tokens = await readTokens();
  if (!tokens) return { ok: false, reason: 'no_tokens' };

  const expiresAt = new Date(tokens.access_expires_at).getTime();
  if (Date.now() < expiresAt - REFRESH_BUFFER_MS) {
    return { ok: true, token: tokens.access_token };
  }

  if (!inFlightRefresh) {
    inFlightRefresh = doRefresh(tokens.refresh_token).finally(() => {
      inFlightRefresh = null;
    });
  }
  return inFlightRefresh;
}

async function doRefresh(refreshToken: string): Promise<AccessTokenResult> {
  const result = await apiPost(
    '/api/v1/auth/mobile/refresh',
    { refresh_token: refreshToken },
    mobileAuthRefreshResponseSchema,
  );
  if (!result.ok) {
    await clearTokens();
    return { ok: false, reason: 'refresh_failed' };
  }
  await storeTokens(result.data);
  return { ok: true, token: result.data.access_token };
}
