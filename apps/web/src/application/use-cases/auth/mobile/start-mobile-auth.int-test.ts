import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { WebCryptoMobileAuthCrypto } from '@/infrastructure/auth/mobile-auth-crypto';
import { DrizzleMobileAuthStateRepository } from '@/infrastructure/db/repositories/drizzle-mobile-auth-state-repository';
import { FakeGoogleOAuthClient } from '@/infrastructure/testing/fake-google-oauth-client';
import { createTestDb, type Db, type Sql, truncateAll } from '@/infrastructure/testing/helpers';
import { makeStartMobileAuth } from './start-mobile-auth';

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

describe('startMobileAuth', () => {
  it('persists a state row and returns a Google authorise URL', async () => {
    const stateRepo = new DrizzleMobileAuthStateRepository(db);
    const google = new FakeGoogleOAuthClient();
    const crypto = new WebCryptoMobileAuthCrypto();
    const start = makeStartMobileAuth({
      stateRepo,
      google,
      crypto,
      redirectUri: 'https://app.test/api/v1/auth/mobile/callback',
    });

    const now = new Date('2026-05-20T12:00:00Z');
    const codeChallenge = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';

    const result = await start({ codeChallenge }, now);

    expect(result.authoriseUrl).toContain('state=');
    expect(result.authoriseUrl).toContain(
      encodeURIComponent('https://app.test/api/v1/auth/mobile/callback'),
    );
    expect(result.state).toMatch(/^[A-Za-z0-9_-]{43}$/);

    const persisted = await stateRepo.findByState(result.state);
    expect(persisted).not.toBeNull();
    expect(persisted?.codeChallenge).toBe(codeChallenge);
    expect(persisted?.consumedAt).toBeNull();
    // Expiry should be ~120s ahead.
    expect(persisted?.expiresAt.getTime() ?? 0).toBeGreaterThan(now.getTime() + 119_000);
    expect(persisted?.expiresAt.getTime() ?? 0).toBeLessThan(now.getTime() + 121_000);
  });

  it('generates a unique state per call', async () => {
    const stateRepo = new DrizzleMobileAuthStateRepository(db);
    const start = makeStartMobileAuth({
      stateRepo,
      google: new FakeGoogleOAuthClient(),
      crypto: new WebCryptoMobileAuthCrypto(),
      redirectUri: 'https://app.test/cb',
    });

    const now = new Date();
    const a = await start({ codeChallenge: 'chal' }, now);
    const b = await start({ codeChallenge: 'chal' }, now);

    expect(a.state).not.toBe(b.state);
  });
});
