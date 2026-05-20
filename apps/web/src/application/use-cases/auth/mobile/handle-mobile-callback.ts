import type { MobileAuthCallbackError } from '@travel-planner/shared';
import type { GoogleOAuthClient } from '@/domain/auth/google-oauth-client';
import type { MobileAuthCrypto } from '@/domain/auth/mobile-auth-crypto';
import type { MobileAuthExchangeCodeRepository } from '@/domain/auth/mobile-auth-exchange-code-repository';
import type { MobileAuthStateRepository } from '@/domain/auth/mobile-auth-state-repository';
import type { UserAccessRepository } from '@/domain/user-access/user-access-repository';

const EXCHANGE_CODE_TTL_MS = 120 * 1000;
const EXCHANGE_CODE_BYTE_LENGTH = 32;
const APP_REDIRECT_BASE = 'travelplanner://auth';

export type HandleMobileCallbackInput = {
  /** Authorisation code Google appended to the redirect URI. */
  readonly code: string;
  /** State parameter Google echoed back. */
  readonly state: string;
};

export type HandleMobileCallbackResult = {
  /**
   * The deep-link URL to redirect the user-agent (system browser) to.
   * Always points at the app's custom scheme; on access denied or
   * other failure the URL carries `?error=…` instead of `?code=…`.
   */
  readonly redirectUrl: string;
};

export type HandleMobileCallbackDeps = {
  readonly stateRepo: MobileAuthStateRepository;
  readonly exchangeCodeRepo: MobileAuthExchangeCodeRepository;
  readonly userAccessRepo: UserAccessRepository;
  readonly google: GoogleOAuthClient;
  readonly crypto: MobileAuthCrypto;
  readonly redirectUri: string;
};

export function makeHandleMobileCallback(deps: HandleMobileCallbackDeps) {
  return async function handleMobileCallback(
    input: HandleMobileCallbackInput,
    now: Date,
  ): Promise<HandleMobileCallbackResult> {
    // 1. Validate state.
    const stateRow = await deps.stateRepo.findByState(input.state);
    if (!stateRow) return deny('invalid_state');
    if (stateRow.consumedAt !== null) return deny('invalid_state');
    if (stateRow.expiresAt.getTime() < now.getTime()) return deny('invalid_state');

    // 2. Exchange Google auth code for profile.
    const exchange = await deps.google.exchangeAuthCode({
      code: input.code,
      redirectUri: deps.redirectUri,
    });
    if (!exchange.ok) return deny('google_error');

    // 3. ADR 029 access check: user must be pre-provisioned + approved.
    const user = await deps.userAccessRepo.findByEmail(exchange.profile.email);
    if (!user?.isApproved) return deny('access_denied');

    // 4. Mark the state row consumed so it can't be replayed.
    await deps.stateRepo.markConsumed(stateRow.id, now);

    // 5. Mint a one-time exchange code, persist its hash + the PKCE
    //    challenge, and deep-link the cleartext into the app.
    const cleartextCode = deps.crypto.randomBase64url(EXCHANGE_CODE_BYTE_LENGTH);
    const codeHash = await deps.crypto.sha256Base64url(cleartextCode);

    await deps.exchangeCodeRepo.create({
      codeHash,
      codeChallenge: stateRow.codeChallenge,
      userId: user.id,
      expiresAt: new Date(now.getTime() + EXCHANGE_CODE_TTL_MS),
    });

    return {
      redirectUrl: `${APP_REDIRECT_BASE}?code=${encodeURIComponent(cleartextCode)}`,
    };
  };
}

function deny(error: MobileAuthCallbackError): HandleMobileCallbackResult {
  return { redirectUrl: `${APP_REDIRECT_BASE}?error=${error}` };
}
