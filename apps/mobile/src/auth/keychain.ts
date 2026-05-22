import type { MobileAuthExchangeResponse } from '@travel-planner/shared';
import * as SecureStore from 'expo-secure-store';

/**
 * Narrow wrapper over `expo-secure-store` for the three-token bundle
 * minted by `POST /api/v1/auth/mobile/exchange` and rotated by
 * `POST /api/v1/auth/mobile/refresh` (SPEC-004 / ADR 051).
 *
 * Three discrete keys, matching the wire shape 1:1 so slice 7's
 * refresh-or-not check can read `access_expires_at` independently of
 * the longer token strings:
 *
 * - `travel_planner.access_token`     — JWT bearer.
 * - `travel_planner.refresh_token`    — opaque rotating token.
 * - `travel_planner.access_expires_at` — ISO 8601 UTC timestamp string.
 *
 * `readTokens()` (added in slice 7) returns the full bundle when
 * all three keys are present, or `null` if any are missing. Partial
 * state from an interrupted earlier flow is treated as no-state.
 */

const ACCESS_TOKEN_KEY = 'travel_planner.access_token';
const REFRESH_TOKEN_KEY = 'travel_planner.refresh_token';
const ACCESS_EXPIRES_AT_KEY = 'travel_planner.access_expires_at';

export type StoredTokens = MobileAuthExchangeResponse;

export async function storeTokens(tokens: MobileAuthExchangeResponse): Promise<void> {
  await Promise.all([
    SecureStore.setItemAsync(ACCESS_TOKEN_KEY, tokens.access_token),
    SecureStore.setItemAsync(REFRESH_TOKEN_KEY, tokens.refresh_token),
    SecureStore.setItemAsync(ACCESS_EXPIRES_AT_KEY, tokens.access_expires_at),
  ]);
}

export async function readTokens(): Promise<StoredTokens | null> {
  const [access_token, refresh_token, access_expires_at] = await Promise.all([
    SecureStore.getItemAsync(ACCESS_TOKEN_KEY),
    SecureStore.getItemAsync(REFRESH_TOKEN_KEY),
    SecureStore.getItemAsync(ACCESS_EXPIRES_AT_KEY),
  ]);
  if (!access_token || !refresh_token || !access_expires_at) return null;
  return { access_token, refresh_token, access_expires_at };
}

export async function clearTokens(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
    SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
    SecureStore.deleteItemAsync(ACCESS_EXPIRES_AT_KEY),
  ]);
}
