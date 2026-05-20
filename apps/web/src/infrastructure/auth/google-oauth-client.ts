/**
 * Real Google OAuth client used by `/api/v1/auth/mobile/*` per ADR 051 §3
 * and SPEC-004 §7.
 *
 * Server-mediated flow: we (the server) act as the OAuth client.
 * Mobile app never touches Google directly. The transition to direct
 * on-device OAuth via Expo Auth Session is tracked as TD-004.
 */

import type {
  BuildAuthoriseUrlInput,
  ExchangeAuthCodeInput,
  ExchangeAuthCodeResult,
  GoogleOAuthClient,
  GoogleProfile,
} from '@/domain/auth/google-oauth-client';

const GOOGLE_AUTHORISE_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo';

export type FetchLike = typeof fetch;

export class FetchGoogleOAuthClient implements GoogleOAuthClient {
  constructor(
    private readonly clientId: string,
    private readonly clientSecret: string,
    private readonly fetchImpl: FetchLike = fetch,
  ) {}

  buildAuthoriseUrl(input: BuildAuthoriseUrlInput): string {
    const url = new URL(GOOGLE_AUTHORISE_URL);
    url.searchParams.set('client_id', this.clientId);
    url.searchParams.set('redirect_uri', input.redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', 'openid email profile');
    url.searchParams.set('state', input.state);
    // We don't pass `code_challenge` to Google — our client is a
    // confidential web client (has a secret). PKCE is between OUR
    // server and the mobile app; Google's part is the secret-based
    // auth code grant.
    return url.toString();
  }

  async exchangeAuthCode(input: ExchangeAuthCodeInput): Promise<ExchangeAuthCodeResult> {
    try {
      const tokenRes = await this.fetchImpl(GOOGLE_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code: input.code,
          client_id: this.clientId,
          client_secret: this.clientSecret,
          redirect_uri: input.redirectUri,
          grant_type: 'authorization_code',
        }),
      });

      if (!tokenRes.ok) return { ok: false, error: 'invalid_grant' };

      const tokenJson = (await tokenRes.json()) as { access_token?: unknown };
      if (typeof tokenJson.access_token !== 'string') {
        return { ok: false, error: 'malformed_response' };
      }

      const profileRes = await this.fetchImpl(GOOGLE_USERINFO_URL, {
        headers: { Authorization: `Bearer ${tokenJson.access_token}` },
      });
      if (!profileRes.ok) return { ok: false, error: 'malformed_response' };

      const profile = (await profileRes.json()) as Record<string, unknown>;
      const sub = profile.sub;
      const email = profile.email;
      const name = profile.name;

      if (typeof sub !== 'string' || typeof email !== 'string') {
        return { ok: false, error: 'malformed_response' };
      }

      const result: GoogleProfile = {
        googleId: sub,
        email,
        name: typeof name === 'string' ? name : null,
      };
      return { ok: true, profile: result };
    } catch {
      return { ok: false, error: 'network_error' };
    }
  }
}
