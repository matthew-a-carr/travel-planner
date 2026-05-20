/**
 * Test double for `GoogleOAuthClient`. Lets tests pre-programme the
 * outcomes of `exchangeAuthCode` and inspect calls to
 * `buildAuthoriseUrl`. Never makes a real HTTP request.
 */

import type {
  BuildAuthoriseUrlInput,
  ExchangeAuthCodeInput,
  ExchangeAuthCodeResult,
  GoogleOAuthClient,
  GoogleProfile,
} from '@/domain/auth/google-oauth-client';

export type FakeGoogleProgramme = {
  /** Result returned by `exchangeAuthCode`. */
  readonly exchangeResult: ExchangeAuthCodeResult;
};

export class FakeGoogleOAuthClient implements GoogleOAuthClient {
  readonly buildCalls: BuildAuthoriseUrlInput[] = [];
  readonly exchangeCalls: ExchangeAuthCodeInput[] = [];
  private behaviour: FakeGoogleProgramme = {
    exchangeResult: { ok: false, error: 'invalid_grant' },
  };

  programme(p: FakeGoogleProgramme): void {
    this.behaviour = p;
  }

  withProfile(profile: GoogleProfile): void {
    this.behaviour = { exchangeResult: { ok: true, profile } };
  }

  buildAuthoriseUrl(input: BuildAuthoriseUrlInput): string {
    this.buildCalls.push(input);
    return `https://accounts.google.test/authorize?state=${encodeURIComponent(input.state)}&redirect_uri=${encodeURIComponent(input.redirectUri)}`;
  }

  async exchangeAuthCode(input: ExchangeAuthCodeInput): Promise<ExchangeAuthCodeResult> {
    this.exchangeCalls.push(input);
    return this.behaviour.exchangeResult;
  }
}
