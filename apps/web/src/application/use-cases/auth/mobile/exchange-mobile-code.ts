import type { MobileAuthCrypto } from '@/domain/auth/mobile-auth-crypto';
import type { MobileAuthExchangeCodeRepository } from '@/domain/auth/mobile-auth-exchange-code-repository';
import { verifyPkceChallengeMatch } from '@/domain/auth/pkce';
import type { RefreshTokenRepository } from '@/domain/auth/refresh-token-repository';
import type { Result } from '@/domain/trip/types';

const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export type ExchangeMobileCodeInput = {
  /** Cleartext one-time exchange code from the deep link. */
  readonly code: string;
  /** PKCE code_verifier the mobile client generated at slice 6 sign-in. */
  readonly codeVerifier: string;
};

export type ExchangeMobileCodeOk = {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly accessExpiresAt: Date;
};

export type ExchangeMobileCodeError = 'invalid_exchange_code' | 'pkce_mismatch';

export type ExchangeMobileCodeResult = Result<ExchangeMobileCodeOk, ExchangeMobileCodeError>;

export type ExchangeMobileCodeDeps = {
  readonly exchangeCodeRepo: MobileAuthExchangeCodeRepository;
  readonly refreshTokenRepo: RefreshTokenRepository;
  readonly crypto: MobileAuthCrypto;
};

export function makeExchangeMobileCode(deps: ExchangeMobileCodeDeps) {
  return async function exchangeMobileCode(
    input: ExchangeMobileCodeInput,
    now: Date,
  ): Promise<ExchangeMobileCodeResult> {
    // 1. Look up the code row by hash.
    const codeHash = await deps.crypto.sha256Base64url(input.code);
    const row = await deps.exchangeCodeRepo.findByCodeHash(codeHash);
    if (!row) return { ok: false, error: 'invalid_exchange_code' };
    if (row.consumedAt !== null) return { ok: false, error: 'invalid_exchange_code' };
    if (row.expiresAt.getTime() < now.getTime()) {
      return { ok: false, error: 'invalid_exchange_code' };
    }

    // 2. Verify the PKCE challenge. Compute the client's challenge by
    //    hashing the supplied verifier; compare against the stored one.
    const computedChallenge = await deps.crypto.sha256Base64url(input.codeVerifier);
    const pkceCheck = verifyPkceChallengeMatch(computedChallenge, row.codeChallenge);
    if (!pkceCheck.ok) {
      // NOTE: do NOT mark the row consumed — a legitimate retry within
      // TTL should still succeed.
      return { ok: false, error: 'pkce_mismatch' };
    }

    // 3. Mark consumed (single-use).
    await deps.exchangeCodeRepo.markConsumed(row.id, now);

    // 4. Mint refresh token + sign access token.
    const refresh = await deps.crypto.mintRefreshToken();
    await deps.refreshTokenRepo.create({
      userId: row.userId,
      tokenHash: refresh.hash,
      issuedAt: now,
      expiresAt: new Date(now.getTime() + REFRESH_TOKEN_TTL_MS),
    });

    const accessExpiresAt = new Date(now.getTime() + ACCESS_TOKEN_TTL_SECONDS * 1000);
    const accessToken = await deps.crypto.signAccessToken({
      userId: row.userId,
      ttlSeconds: ACCESS_TOKEN_TTL_SECONDS,
    });

    return {
      ok: true,
      value: {
        accessToken,
        refreshToken: refresh.cleartext,
        accessExpiresAt,
      },
    };
  };
}
