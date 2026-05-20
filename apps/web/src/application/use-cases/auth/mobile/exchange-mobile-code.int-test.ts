import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { verifyAccessToken } from '@/infrastructure/auth/bearer-token';
import { WebCryptoMobileAuthCrypto } from '@/infrastructure/auth/mobile-auth-crypto';
import { DrizzleMobileAuthExchangeCodeRepository } from '@/infrastructure/db/repositories/drizzle-mobile-auth-exchange-code-repository';
import { DrizzleRefreshTokenRepository } from '@/infrastructure/db/repositories/drizzle-refresh-token-repository';
import {
  createTestDb,
  type Db,
  type Sql,
  seedUser,
  truncateAll,
} from '@/infrastructure/testing/helpers';
import { makeExchangeMobileCode } from './exchange-mobile-code';

let db: Db;
let sql: Sql;

beforeAll(() => {
  ({ db, sql } = createTestDb());
});

afterAll(async () => {
  await sql.end();
});

beforeEach(async () => {
  await truncateAll(db);
});

async function setupRow(opts: {
  codeChallenge: string;
  now: Date;
  expiresAt?: Date;
  consumed?: boolean;
}) {
  const user = await seedUser(db, { isApproved: true });
  const exchangeCodeRepo = new DrizzleMobileAuthExchangeCodeRepository(db);
  const refreshTokenRepo = new DrizzleRefreshTokenRepository(db);
  const cryptoImpl = new WebCryptoMobileAuthCrypto();

  const cleartext = cryptoImpl.randomBase64url(32);
  const codeHash = await cryptoImpl.sha256Base64url(cleartext);

  const row = await exchangeCodeRepo.create({
    codeHash,
    codeChallenge: opts.codeChallenge,
    userId: user.id,
    expiresAt: opts.expiresAt ?? new Date(opts.now.getTime() + 120_000),
  });
  if (opts.consumed) {
    await exchangeCodeRepo.markConsumed(row.id, opts.now);
  }

  const exchange = makeExchangeMobileCode({
    exchangeCodeRepo,
    refreshTokenRepo,
    crypto: cryptoImpl,
  });

  return { cleartext, user, exchange, refreshTokenRepo, exchangeCodeRepo, cryptoImpl };
}

describe('exchangeMobileCode', () => {
  it('happy path: returns access + refresh and persists refresh row', async () => {
    const cryptoImpl = new WebCryptoMobileAuthCrypto();
    const verifier = cryptoImpl.randomBase64url(32);
    const challenge = await cryptoImpl.sha256Base64url(verifier);
    const now = new Date('2026-05-20T12:00:00Z');

    const { cleartext, user, exchange, refreshTokenRepo } = await setupRow({
      codeChallenge: challenge,
      now,
    });

    const result = await exchange({ code: cleartext, codeVerifier: verifier }, now);
    if (!result.ok) throw new Error(`expected ok, got ${result.error}`);

    expect(result.value.accessExpiresAt.getTime()).toBe(now.getTime() + 15 * 60 * 1000);

    // Access token verifies against the same signing key.
    const verified = await verifyAccessToken(result.value.accessToken);
    expect(verified.ok).toBe(true);
    if (verified.ok) expect(verified.value.userId).toBe(user.id);

    // Refresh row exists with sha256 of the returned refresh token.
    const refreshHash = await cryptoImpl.sha256Base64url(result.value.refreshToken);
    const refreshRow = await refreshTokenRepo.findByTokenHash(refreshHash);
    expect(refreshRow?.userId).toBe(user.id);
  });

  it('rejects pkce_mismatch and does NOT consume the code', async () => {
    const cryptoImpl = new WebCryptoMobileAuthCrypto();
    const realVerifier = cryptoImpl.randomBase64url(32);
    const challenge = await cryptoImpl.sha256Base64url(realVerifier);
    const now = new Date();

    const { cleartext, exchange, exchangeCodeRepo } = await setupRow({
      codeChallenge: challenge,
      now,
    });

    const wrongVerifier = cryptoImpl.randomBase64url(32);
    const result = await exchange({ code: cleartext, codeVerifier: wrongVerifier }, now);
    expect(result).toEqual({ ok: false, error: 'pkce_mismatch' });

    // Row is still consumable — a legitimate retry within TTL should work.
    const codeHash = await cryptoImpl.sha256Base64url(cleartext);
    const row = await exchangeCodeRepo.findByCodeHash(codeHash);
    expect(row?.consumedAt).toBeNull();
  });

  it('rejects invalid_exchange_code for an unknown code', async () => {
    const user = await seedUser(db, { isApproved: true });
    expect(user.id).toBeTruthy();
    const exchange = makeExchangeMobileCode({
      exchangeCodeRepo: new DrizzleMobileAuthExchangeCodeRepository(db),
      refreshTokenRepo: new DrizzleRefreshTokenRepository(db),
      crypto: new WebCryptoMobileAuthCrypto(),
    });

    const result = await exchange({ code: 'never-existed', codeVerifier: 'anything' }, new Date());
    expect(result).toEqual({ ok: false, error: 'invalid_exchange_code' });
  });

  it('rejects invalid_exchange_code when the row is already consumed', async () => {
    const cryptoImpl = new WebCryptoMobileAuthCrypto();
    const verifier = cryptoImpl.randomBase64url(32);
    const challenge = await cryptoImpl.sha256Base64url(verifier);
    const now = new Date();

    const { cleartext, exchange } = await setupRow({
      codeChallenge: challenge,
      now,
      consumed: true,
    });

    const result = await exchange({ code: cleartext, codeVerifier: verifier }, now);
    expect(result).toEqual({ ok: false, error: 'invalid_exchange_code' });
  });

  it('rejects invalid_exchange_code when expired', async () => {
    const cryptoImpl = new WebCryptoMobileAuthCrypto();
    const verifier = cryptoImpl.randomBase64url(32);
    const challenge = await cryptoImpl.sha256Base64url(verifier);
    const now = new Date('2026-05-20T12:00:00Z');

    const { cleartext, exchange } = await setupRow({
      codeChallenge: challenge,
      now,
      expiresAt: new Date(now.getTime() - 1_000),
    });

    const result = await exchange({ code: cleartext, codeVerifier: verifier }, now);
    expect(result).toEqual({ ok: false, error: 'invalid_exchange_code' });
  });
});
