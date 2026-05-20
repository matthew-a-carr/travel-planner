import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { verifyAccessToken } from '@/infrastructure/auth/bearer-token';
import { WebCryptoMobileAuthCrypto } from '@/infrastructure/auth/mobile-auth-crypto';
import { DrizzleRefreshTokenRepository } from '@/infrastructure/db/repositories/drizzle-refresh-token-repository';
import {
  createTestDb,
  type Db,
  type Sql,
  seedUser,
  truncateAll,
} from '@/infrastructure/testing/helpers';
import { makeRefreshMobileTokens } from './refresh-mobile-tokens';

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

const HOUR_MS = 60 * 60 * 1000;

async function seedActiveRefresh(
  userId: string,
  cryptoImpl: WebCryptoMobileAuthCrypto,
  now: Date,
): Promise<{ cleartext: string; hash: string }> {
  const refreshTokenRepo = new DrizzleRefreshTokenRepository(db);
  const { cleartext, hash } = await cryptoImpl.mintRefreshToken();
  await refreshTokenRepo.create({
    userId,
    tokenHash: hash,
    issuedAt: now,
    expiresAt: new Date(now.getTime() + 30 * 24 * HOUR_MS),
  });
  return { cleartext, hash };
}

describe('refreshMobileTokens', () => {
  it('happy path: rotates and returns a fresh pair', async () => {
    const cryptoImpl = new WebCryptoMobileAuthCrypto();
    const user = await seedUser(db, { isApproved: true });
    const now = new Date('2026-05-20T12:00:00Z');
    const { cleartext } = await seedActiveRefresh(user.id, cryptoImpl, now);

    const refresh = makeRefreshMobileTokens({
      refreshTokenRepo: new DrizzleRefreshTokenRepository(db),
      crypto: cryptoImpl,
    });

    const result = await refresh({ refreshToken: cleartext }, now);
    if (!result.ok) throw new Error(`expected ok, got ${result.error}`);
    expect(result.value.refreshToken).not.toBe(cleartext);

    const verified = await verifyAccessToken(result.value.accessToken);
    expect(verified.ok).toBe(true);
    if (verified.ok) expect(verified.value.userId).toBe(user.id);
  });

  it('detects reuse: presenting the old token again revokes the whole chain and fires the callback', async () => {
    const cryptoImpl = new WebCryptoMobileAuthCrypto();
    const user = await seedUser(db, { isApproved: true });
    const now = new Date('2026-05-20T12:00:00Z');
    const { cleartext: original } = await seedActiveRefresh(user.id, cryptoImpl, now);

    const onChainRevoked = vi.fn();
    const refresh = makeRefreshMobileTokens({
      refreshTokenRepo: new DrizzleRefreshTokenRepository(db),
      crypto: cryptoImpl,
      onChainRevoked,
    });

    // First refresh — happy path, rotates.
    const first = await refresh({ refreshToken: original }, now);
    expect(first.ok).toBe(true);

    // Second refresh presenting the original token — reuse detected.
    const second = await refresh({ refreshToken: original }, now);
    expect(second).toEqual({ ok: false, error: 'refresh_reused' });
    expect(onChainRevoked).toHaveBeenCalledTimes(1);
    expect(onChainRevoked.mock.calls[0][0].userId).toBe(user.id);
    expect(onChainRevoked.mock.calls[0][0].chainIds).toHaveLength(2);

    // Confirm every link in the chain has revokedAt set.
    const repo = new DrizzleRefreshTokenRepository(db);
    const originalHash = await cryptoImpl.sha256Base64url(original);
    const originalRow = await repo.findByTokenHash(originalHash);
    expect(originalRow?.revokedAt).not.toBeNull();
    if (first.ok) {
      const successorHash = await cryptoImpl.sha256Base64url(first.value.refreshToken);
      const successorRow = await repo.findByTokenHash(successorHash);
      expect(successorRow?.revokedAt).not.toBeNull();
    }
  });

  it('returns refresh_unknown for an unknown token', async () => {
    const refresh = makeRefreshMobileTokens({
      refreshTokenRepo: new DrizzleRefreshTokenRepository(db),
      crypto: new WebCryptoMobileAuthCrypto(),
    });

    const result = await refresh({ refreshToken: 'never-existed-token' }, new Date());
    expect(result).toEqual({ ok: false, error: 'refresh_unknown' });
  });

  it('returns refresh_expired for an expired but unrotated token', async () => {
    const cryptoImpl = new WebCryptoMobileAuthCrypto();
    const user = await seedUser(db, { isApproved: true });
    const now = new Date('2026-05-20T12:00:00Z');

    const refreshTokenRepo = new DrizzleRefreshTokenRepository(db);
    const { cleartext, hash } = await cryptoImpl.mintRefreshToken();
    await refreshTokenRepo.create({
      userId: user.id,
      tokenHash: hash,
      issuedAt: new Date(now.getTime() - 31 * 24 * HOUR_MS),
      expiresAt: new Date(now.getTime() - HOUR_MS),
    });

    const refresh = makeRefreshMobileTokens({
      refreshTokenRepo,
      crypto: cryptoImpl,
    });

    const result = await refresh({ refreshToken: cleartext }, now);
    expect(result).toEqual({ ok: false, error: 'refresh_expired' });
  });
});
