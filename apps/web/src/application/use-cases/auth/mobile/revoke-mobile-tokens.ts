import type { MobileAuthCrypto } from '@/domain/auth/mobile-auth-crypto';
import type { RefreshTokenRepository } from '@/domain/auth/refresh-token-repository';

export type RevokeMobileTokensInput = {
  /** Cleartext refresh token from the client (we hash it ourselves). */
  readonly refreshToken: string;
};

export type RevokeMobileTokensDeps = {
  readonly refreshTokenRepo: RefreshTokenRepository;
  readonly crypto: MobileAuthCrypto;
};

/**
 * Sign-out: revoke the presented (active head) refresh-token row.
 *
 * Predecessor rows in the same chain are intentionally NOT touched
 * here — they already carry `replaced_by_id`, so any attempt to
 * reuse them fires the existing reuse-detection path in
 * `refreshMobileTokens` (ADR 054) which then revokes the rest of
 * the chain.
 *
 * The operation is idempotent and non-revealing:
 *
 * - Unknown tokens → no-op (no DB writes).
 * - Already-revoked tokens → `revokeChain` is a no-op on rows
 *   where `revoked_at IS NOT NULL` already, so the earlier
 *   timestamp survives.
 * - Malformed tokens → hash a bogus string; `findByTokenHash`
 *   returns null; no-op.
 *
 * The caller (route handler) responds with `204 No Content`
 * unconditionally. The endpoint promises "if you had a token,
 * it's revoked now," not "this token was valid."
 */
export function makeRevokeMobileTokens(deps: RevokeMobileTokensDeps) {
  return async function revokeMobileTokens(
    input: RevokeMobileTokensInput,
    now: Date,
  ): Promise<void> {
    const presentedHash = await deps.crypto.sha256Base64url(input.refreshToken);
    const found = await deps.refreshTokenRepo.findByTokenHash(presentedHash);
    if (found === null) return;

    await deps.refreshTokenRepo.revokeChain([found.id], now);
  };
}
