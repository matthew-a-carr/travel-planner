/**
 * Domain port for the server-side Google OAuth client (web-mediated PKCE
 * flow per ADR 051 §3).
 *
 * Implementation lives in `src/infrastructure/auth/google-oauth-client.ts`
 * and uses `fetch` against Google's OAuth endpoints directly. Tests pass
 * a fake.
 *
 * Note: the mobile client never talks to Google. The server initiates
 * the OAuth dance, the user signs in in their system browser, Google
 * redirects back to our `/auth/mobile/callback`, then we deep-link a
 * one-time code into the app. See TD-004 for the EPIC-002 transition
 * to direct on-device OAuth via Expo Auth Session + an iOS-type client.
 */

export type BuildAuthoriseUrlInput = {
  /** Anti-CSRF random string we persist in `mobile_auth_states`. */
  readonly state: string;
  /**
   * PKCE S256 code_challenge from the mobile client. We persist it so
   * `/exchange` can verify the client's `code_verifier` matches.
   * Note: Google doesn't use PKCE for our server-mediated flow (we're
   * the OAuth client, not the user agent) — it's the *mobile* client's
   * PKCE handshake we're bridging.
   */
  readonly codeChallenge: string;
  /** Fully-qualified URL Google will redirect the user back to. */
  readonly redirectUri: string;
};

export type GoogleProfile = {
  /** Stable Google user id (`sub` claim). */
  readonly googleId: string;
  readonly email: string;
  /** Display name from Google profile (may be null for some accounts). */
  readonly name: string | null;
};

export type ExchangeAuthCodeInput = {
  readonly code: string;
  readonly redirectUri: string;
};

export type ExchangeAuthCodeResult =
  | { readonly ok: true; readonly profile: GoogleProfile }
  | {
      readonly ok: false;
      readonly error: 'invalid_grant' | 'network_error' | 'malformed_response';
    };

export interface GoogleOAuthClient {
  buildAuthoriseUrl(input: BuildAuthoriseUrlInput): string;
  exchangeAuthCode(input: ExchangeAuthCodeInput): Promise<ExchangeAuthCodeResult>;
}
