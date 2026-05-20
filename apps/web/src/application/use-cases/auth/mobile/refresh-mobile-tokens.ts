import type { MobileAuthCrypto } from '@/domain/auth/mobile-auth-crypto';
import type { RefreshTokenRepository } from '@/domain/auth/refresh-token-repository';
import { decideRotation } from '@/domain/auth/refresh-token-rotation';
import type { Result } from '@/domain/trip/types';

const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export type RefreshMobileTokensInput = {
  /** Cleartext refresh token from the client (we hash it ourselves). */
  readonly refreshToken: string;
};

export type RefreshMobileTokensOk = {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly accessExpiresAt: Date;
};

export type RefreshMobileTokensError =
  | 'refresh_reused' // chain revoked; client must re-login
  | 'refresh_expired'
  | 'refresh_revoked'
  | 'refresh_unknown';

export type RefreshMobileTokensResult = Result<RefreshMobileTokensOk, RefreshMobileTokensError>;

export type RefreshMobileTokensDeps = {
  readonly refreshTokenRepo: RefreshTokenRepository;
  readonly crypto: MobileAuthCrypto;
  /**
   * Optional observer; called once on every reuse-detection trigger
   * with the chain that was revoked. Step 8 wires this to Sentry.
   * Default no-op keeps unit tests clean.
   */
  readonly onChainRevoked?: (input: {
    readonly userId: string;
    readonly chainIds: readonly string[];
  }) => void;
};

export function makeRefreshMobileTokens(deps: RefreshMobileTokensDeps) {
  const onChainRevoked = deps.onChainRevoked ?? (() => {});

  return async function refreshMobileTokens(
    input: RefreshMobileTokensInput,
    now: Date,
  ): Promise<RefreshMobileTokensResult> {
    const presentedHash = await deps.crypto.sha256Base64url(input.refreshToken);
    const successor = await deps.crypto.mintRefreshToken();

    // First check the easy "is it even a valid token" cases without
    // taking the row lock — keeps the SELECT FOR UPDATE scoped to
    // tokens that have a chance of being usable.
    const peek = await deps.refreshTokenRepo.findByTokenHash(presentedHash);
    if (peek === null) return { ok: false, error: 'refresh_unknown' };

    const preDecision = decideRotation({ now, presented: peek, chainFromPresented: [] });
    // The peek-based decision can't distinguish reused (which needs the
    // chain) from rotate, but it CAN catch revoked/expired/unknown
    // cheaply. For reuse + happy-path we hand off to the locked
    // `rotate()` call.
    if (preDecision.kind === 'revoked') return { ok: false, error: 'refresh_revoked' };
    if (preDecision.kind === 'expired') return { ok: false, error: 'refresh_expired' };

    const outcome = await deps.refreshTokenRepo.rotate(
      {
        presentedTokenHash: presentedHash,
        successor: {
          userId: peek.userId,
          tokenHash: successor.hash,
          issuedAt: now,
          expiresAt: new Date(now.getTime() + REFRESH_TOKEN_TTL_MS),
        },
      },
      now,
    );

    switch (outcome.kind) {
      case 'rotated': {
        const accessToken = await deps.crypto.signAccessToken({
          userId: outcome.successor.userId,
          ttlSeconds: ACCESS_TOKEN_TTL_SECONDS,
        });
        return {
          ok: true,
          value: {
            accessToken,
            refreshToken: successor.cleartext,
            accessExpiresAt: new Date(now.getTime() + ACCESS_TOKEN_TTL_SECONDS * 1000),
          },
        };
      }
      case 'reused': {
        const chainIds = outcome.chain.map((row) => row.id);
        await deps.refreshTokenRepo.revokeChain(chainIds, now);
        onChainRevoked({ userId: peek.userId, chainIds });
        return { ok: false, error: 'refresh_reused' };
      }
      case 'unusable':
        return {
          ok: false,
          error: outcome.reason === 'expired' ? 'refresh_expired' : 'refresh_revoked',
        };
      case 'unknown':
        // Race: row disappeared between peek and rotate (cascade
        // delete of the user mid-flight). Treat as unknown.
        return { ok: false, error: 'refresh_unknown' };
    }
  };
}
