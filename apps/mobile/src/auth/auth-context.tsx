/**
 * AuthProvider — single owner of "who is the current user" on mobile.
 *
 * Three-state machine:
 *   - 'unknown'     — cold-start in flight; native splash covers UI.
 *   - 'signed_out'  — no valid session; sign-in screen renders.
 *   - 'signed_in'   — full /me payload available; me screen renders.
 *
 * Cold-start (in a useEffect on mount):
 *   1. getAccessToken() — reads Keychain, refreshes if needed,
 *      single-flight under concurrency.
 *   2. On no_tokens / refresh_failed → signed_out.
 *   3. On ok → call /me with the bearer.
 *   4. On /me success → signed_in.
 *   5. On /me failure (ANY kind) → clearTokens + signed_out (Q8 in
 *      SPEC-007: all failures collapse, no boot_error state).
 *
 * signIn(tokens):
 *   - storeTokens → call /me → on success: signed_in; on failure:
 *     clearTokens + signed_out. Same end state as cold-start's
 *     /me-failure branch.
 *
 * signOut():
 *   - Read tokens BEFORE clearTokens (the revoke call needs the
 *     refresh token).
 *   - Optimistic state transition + clear Keychain immediately so
 *     the UI flips fast.
 *   - Fire-and-forget POST /api/v1/auth/mobile/revoke. Server-side
 *     revocation happens in the background; the user is never
 *     blocked on it.
 */

import type { MobileAuthExchangeResponse } from '@travel-planner/shared';
import { type MeResponse, meResponseSchema } from '@travel-planner/shared';
import {
  createContext,
  type PropsWithChildren,
  type ReactElement,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { apiGet, apiPost } from '../api/client';
import { getAccessToken } from './get-access-token';
import { clearTokens, readTokens, storeTokens } from './keychain';

export type AuthState =
  | { status: 'unknown' }
  | { status: 'signed_out' }
  | { status: 'signed_in'; me: MeResponse };

export type AuthContextValue = AuthState & {
  signIn: (tokens: MobileAuthExchangeResponse) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren): ReactElement {
  const [state, setState] = useState<AuthState>({ status: 'unknown' });

  // Cold-start effect — runs once on mount.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const access = await getAccessToken();
        if (cancelled) return;

        if (!access.ok) {
          // 'no_tokens' → nothing in Keychain; 'refresh_failed' → getAccessToken
          // already called clearTokens. Either way: signed_out.
          setState({ status: 'signed_out' });
          return;
        }

        const me = await apiGet('/api/v1/me', meResponseSchema, access.token);
        if (cancelled) return;

        if (!me.ok) {
          // Q8 in SPEC-007: ALL /me failures collapse to signed_out +
          // clear Keychain. Audience accepts wifi-blip → re-OAuth.
          await clearTokens();
          setState({ status: 'signed_out' });
          return;
        }

        setState({ status: 'signed_in', me: me.data });
      } catch {
        // Defensive: cold-start must always leave 'unknown' so the
        // AuthGuard can hide the splash. An unhandled throw here (e.g.
        // a Keychain read error) would otherwise strand the app on the
        // splash forever. Fail safe to signed_out → the sign-in screen.
        if (!cancelled) setState({ status: 'signed_out' });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(async (tokens: MobileAuthExchangeResponse) => {
    await storeTokens(tokens);
    const me = await apiGet('/api/v1/me', meResponseSchema, tokens.access_token);
    if (!me.ok) {
      // Rollback the just-written tokens — keeps Keychain + state
      // in lock-step. Same end state as cold-start /me-failure.
      await clearTokens();
      setState({ status: 'signed_out' });
      return;
    }
    setState({ status: 'signed_in', me: me.data });
  }, []);

  const signOut = useCallback(async () => {
    // Read tokens BEFORE clearTokens wipes them — the revoke call
    // needs the refresh token.
    const tokens = await readTokens();

    // Optimistic: transition state + clear Keychain immediately so
    // the UI flips fast. Fire-and-forget revoke runs in the
    // background.
    setState({ status: 'signed_out' });
    await clearTokens();

    if (tokens) {
      // No response schema — endpoint returns 204 No Content.
      // .catch() swallows any error: fire-and-forget never throws
      // to the caller. A failed revoke means the refresh token sits
      // server-side until its natural 30d expiry; not ideal, but
      // never blocks sign-out UX.
      void apiPost('/api/v1/auth/mobile/revoke', {
        refresh_token: tokens.refresh_token,
      }).catch(() => {
        /* fire-and-forget */
      });
    }
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, signIn, signOut }}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (ctx === null) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return ctx;
}
