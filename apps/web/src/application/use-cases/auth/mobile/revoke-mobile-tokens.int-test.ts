import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { WebCryptoMobileAuthCrypto } from '@/infrastructure/auth/mobile-auth-crypto';
import { DrizzleRefreshTokenRepository } from '@/infrastructure/db/repositories/drizzle-refresh-token-repository';
import {
  createTestDb,
  type Db,
  type Sql,
  seedUser,
  truncateAll,
} from '@/infrastructure/testing/helpers';
import { makeRevokeMobileTokens } from './revoke-mobile-tokens';

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

describe('revokeMobileTokens', () => {
  it('revokes the presented (active head) row by setting revoked_at', async () => {
    const cryptoImpl = new WebCryptoMobileAuthCrypto();
    const user = await seedUser(db, { isApproved: true });
    const now = new Date('2026-05-22T10:00:00Z');

    const refreshTokenRepo = new DrizzleRefreshTokenRepository(db);
    const { cleartext, hash } = await cryptoImpl.mintRefreshToken();
    await refreshTokenRepo.create({
      userId: user.id,
      tokenHash: hash,
      issuedAt: now,
      expiresAt: new Date(now.getTime() + 30 * 24 * HOUR_MS),
    });

    const revoke = makeRevokeMobileTokens({
      refreshTokenRepo,
      crypto: cryptoImpl,
    });

    await revoke({ refreshToken: cleartext }, now);

    const row = await refreshTokenRepo.findByTokenHash(hash);
    expect(row?.revokedAt?.getTime()).toBe(now.getTime());
  });

  it('is a no-op for an unknown token (no rows touched)', async () => {
    const cryptoImpl = new WebCryptoMobileAuthCrypto();
    const user = await seedUser(db, { isApproved: true });
    const now = new Date('2026-05-22T10:00:00Z');

    // Seed an unrelated active token to verify it isn't touched.
    const refreshTokenRepo = new DrizzleRefreshTokenRepository(db);
    const { hash: bystanderHash } = await cryptoImpl.mintRefreshToken();
    await refreshTokenRepo.create({
      userId: user.id,
      tokenHash: bystanderHash,
      issuedAt: now,
      expiresAt: new Date(now.getTime() + 30 * 24 * HOUR_MS),
    });

    const revoke = makeRevokeMobileTokens({
      refreshTokenRepo,
      crypto: cryptoImpl,
    });

    await revoke({ refreshToken: 'never-existed-cleartext' }, now);

    const bystander = await refreshTokenRepo.findByTokenHash(bystanderHash);
    expect(bystander?.revokedAt).toBeNull();
  });

  it('is idempotent: re-revoking preserves the earlier revoked_at', async () => {
    const cryptoImpl = new WebCryptoMobileAuthCrypto();
    const user = await seedUser(db, { isApproved: true });
    const firstRevokeAt = new Date('2026-05-22T10:00:00Z');
    const secondRevokeAt = new Date('2026-05-22T11:00:00Z');

    const refreshTokenRepo = new DrizzleRefreshTokenRepository(db);
    const { cleartext, hash } = await cryptoImpl.mintRefreshToken();
    await refreshTokenRepo.create({
      userId: user.id,
      tokenHash: hash,
      issuedAt: firstRevokeAt,
      expiresAt: new Date(firstRevokeAt.getTime() + 30 * 24 * HOUR_MS),
    });

    const revoke = makeRevokeMobileTokens({
      refreshTokenRepo,
      crypto: cryptoImpl,
    });

    await revoke({ refreshToken: cleartext }, firstRevokeAt);
    await revoke({ refreshToken: cleartext }, secondRevokeAt);

    const row = await refreshTokenRepo.findByTokenHash(hash);
    expect(row?.revokedAt?.getTime()).toBe(firstRevokeAt.getTime());
  });
});
