import type { MobileAuthCrypto } from '@/domain/auth/mobile-auth-crypto';
import type { MobileAuthExchangeCodeRepository } from '@/domain/auth/mobile-auth-exchange-code-repository';
import type { MobileAuthStateRepository } from '@/domain/auth/mobile-auth-state-repository';
import type { UserAccessRepository } from '@/domain/user-access/user-access-repository';

/**
 * **Test-only** auth seam (SPEC-014, EPIC-004 slice 2).
 *
 * Structurally this is `handle-mobile-callback` with the Google exchange
 * removed: given a live `state` from a prior `/start`, it mints a one-time
 * exchange code keyed to that state's stored PKCE challenge for a seeded,
 * pre-approved user — so the real `/exchange` verification passes against the
 * verifier the client already holds. Same TTL, same one-time-code minting,
 * same deep-link contract, so the substitute browser leg returns the identical
 * URL shape `/callback` 302-redirects to.
 *
 * It grants no access the normal flow wouldn't: the user must already exist
 * and be approved (ADR 029), and the caller must already have created the
 * `state` via `/start`. The endpoint that fronts this use case is double-gated
 * (explicit flag + never on Vercel) — see the route handler.
 */

const EXCHANGE_CODE_TTL_MS = 120 * 1000;
const EXCHANGE_CODE_BYTE_LENGTH = 32;
const APP_REDIRECT_BASE = 'travelplanner://auth';

/** Closed set of `?error=` reasons this seam can emit. */
export type MintTestExchangeCodeError = 'invalid_state' | 'access_denied';

export type MintTestExchangeCodeInput = {
  /** State from a prior `/start` — links the minted code to a stored challenge. */
  readonly state: string;
  /** Email of the seeded user to sign in as (must exist + be approved). */
  readonly email: string;
};

export type MintTestExchangeCodeResult = {
  /**
   * The `travelplanner://auth?...` deep link. Carries `?code=<one-time>` on
   * success or `?error=<reason>` on failure — the same shape `/callback`
   * produces, so `runSignInFlow` can't distinguish the seam from the real flow.
   */
  readonly redirectUrl: string;
};

export type MintTestExchangeCodeDeps = {
  readonly stateRepo: MobileAuthStateRepository;
  readonly exchangeCodeRepo: MobileAuthExchangeCodeRepository;
  readonly userAccessRepo: UserAccessRepository;
  readonly crypto: MobileAuthCrypto;
};

export function makeMintTestExchangeCode(deps: MintTestExchangeCodeDeps) {
  return async function mintTestExchangeCode(
    input: MintTestExchangeCodeInput,
    now: Date,
  ): Promise<MintTestExchangeCodeResult> {
    // 1. Validate state (single-use + TTL, like /callback).
    const stateRow = await deps.stateRepo.findByState(input.state);
    if (!stateRow) return deny('invalid_state');
    if (stateRow.consumedAt !== null) return deny('invalid_state');
    if (stateRow.expiresAt.getTime() < now.getTime()) return deny('invalid_state');

    // 2. ADR 029 access check — same rule as the real callback.
    const user = await deps.userAccessRepo.findByEmail(input.email);
    if (!user?.isApproved) return deny('access_denied');

    // 3. Burn the state row.
    await deps.stateRepo.markConsumed(stateRow.id, now);

    // 4. Mint a one-time exchange code keyed to the stored PKCE challenge.
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

function deny(error: MintTestExchangeCodeError): MintTestExchangeCodeResult {
  return { redirectUrl: `${APP_REDIRECT_BASE}?error=${error}` };
}
