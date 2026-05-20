import type { GoogleOAuthClient } from '@/domain/auth/google-oauth-client';
import type { MobileAuthCrypto } from '@/domain/auth/mobile-auth-crypto';
import type { MobileAuthStateRepository } from '@/domain/auth/mobile-auth-state-repository';

const STATE_TTL_MS = 120 * 1000;
const STATE_BYTE_LENGTH = 32; // → 43-char base64url

export type StartMobileAuthInput = {
  /** PKCE S256 challenge from the mobile client. */
  readonly codeChallenge: string;
};

export type StartMobileAuthResult = {
  readonly authoriseUrl: string;
  readonly state: string;
};

export type StartMobileAuthDeps = {
  readonly stateRepo: MobileAuthStateRepository;
  readonly google: GoogleOAuthClient;
  readonly crypto: MobileAuthCrypto;
  readonly redirectUri: string;
};

export function makeStartMobileAuth(deps: StartMobileAuthDeps) {
  return async function startMobileAuth(
    input: StartMobileAuthInput,
    now: Date,
  ): Promise<StartMobileAuthResult> {
    const state = deps.crypto.randomBase64url(STATE_BYTE_LENGTH);

    await deps.stateRepo.create({
      state,
      codeChallenge: input.codeChallenge,
      expiresAt: new Date(now.getTime() + STATE_TTL_MS),
    });

    const authoriseUrl = deps.google.buildAuthoriseUrl({
      state,
      codeChallenge: input.codeChallenge,
      redirectUri: deps.redirectUri,
    });

    return { authoriseUrl, state };
  };
}
