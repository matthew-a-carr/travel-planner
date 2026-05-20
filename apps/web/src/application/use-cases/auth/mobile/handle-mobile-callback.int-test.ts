import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { WebCryptoMobileAuthCrypto } from '@/infrastructure/auth/mobile-auth-crypto';
import { DrizzleMobileAuthExchangeCodeRepository } from '@/infrastructure/db/repositories/drizzle-mobile-auth-exchange-code-repository';
import { DrizzleMobileAuthStateRepository } from '@/infrastructure/db/repositories/drizzle-mobile-auth-state-repository';
import { DrizzleUserAccessRepository } from '@/infrastructure/db/repositories/drizzle-user-access-repository';
import { FakeGoogleOAuthClient } from '@/infrastructure/testing/fake-google-oauth-client';
import {
  createTestDb,
  type Db,
  type Sql,
  seedUser,
  truncateAll,
} from '@/infrastructure/testing/helpers';
import { makeHandleMobileCallback } from './handle-mobile-callback';

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

const REDIRECT_URI = 'https://app.test/api/v1/auth/mobile/callback';

async function setupCase(opts: {
  approved: boolean;
  userExists?: boolean;
  email?: string;
  now?: Date;
}): Promise<{
  state: string;
  google: FakeGoogleOAuthClient;
  exchangeCodeRepo: DrizzleMobileAuthExchangeCodeRepository;
  callback: ReturnType<typeof makeHandleMobileCallback>;
  now: Date;
  email: string;
}> {
  const now = opts.now ?? new Date('2026-05-20T12:00:00Z');
  const email = opts.email ?? 'matt@example.com';

  if (opts.userExists !== false) {
    await seedUser(db, { email, isApproved: opts.approved });
  }

  const stateRepo = new DrizzleMobileAuthStateRepository(db);
  const exchangeCodeRepo = new DrizzleMobileAuthExchangeCodeRepository(db);
  const userAccessRepo = new DrizzleUserAccessRepository(db);
  const google = new FakeGoogleOAuthClient();
  const cryptoImpl = new WebCryptoMobileAuthCrypto();

  // Seed a state row directly via the repo.
  const stateRow = await stateRepo.create({
    state: 'state-abc',
    codeChallenge: 'chal-from-mobile',
    expiresAt: new Date(now.getTime() + 60_000),
  });

  const callback = makeHandleMobileCallback({
    stateRepo,
    exchangeCodeRepo,
    userAccessRepo,
    google,
    crypto: cryptoImpl,
    redirectUri: REDIRECT_URI,
  });

  return { state: stateRow.state, google, exchangeCodeRepo, callback, now, email };
}

describe('handleMobileCallback', () => {
  it('happy path: deep-links a one-time code for an approved user', async () => {
    const { state, google, callback, exchangeCodeRepo, now, email } = await setupCase({
      approved: true,
    });
    google.withProfile({ googleId: 'g123', email, name: 'Matt' });

    const result = await callback({ code: 'goog-code', state }, now);

    expect(result.redirectUrl).toMatch(/^travelplanner:\/\/auth\?code=/);
    const code = new URL(result.redirectUrl).searchParams.get('code');
    expect(code).toBeTruthy();
    const cryptoImpl = new WebCryptoMobileAuthCrypto();
    const codeHash = await cryptoImpl.sha256Base64url(code as string);
    const row = await exchangeCodeRepo.findByCodeHash(codeHash);
    expect(row).not.toBeNull();
    expect(row?.codeChallenge).toBe('chal-from-mobile');
  });

  it('deep-links access_denied for an unapproved user', async () => {
    const { state, google, callback, exchangeCodeRepo, now, email } = await setupCase({
      approved: false,
    });
    google.withProfile({ googleId: 'g123', email, name: 'Matt' });

    const result = await callback({ code: 'goog-code', state }, now);

    expect(result.redirectUrl).toBe('travelplanner://auth?error=access_denied');

    // No exchange code row was created.
    const cryptoImpl = new WebCryptoMobileAuthCrypto();
    const codeHash = await cryptoImpl.sha256Base64url('anything');
    expect(await exchangeCodeRepo.findByCodeHash(codeHash)).toBeNull();
  });

  it('deep-links access_denied when the user row does not exist', async () => {
    const { state, google, callback, now } = await setupCase({
      approved: false,
      userExists: false,
      email: 'stranger@example.com',
    });
    google.withProfile({ googleId: 'g999', email: 'stranger@example.com', name: null });

    const result = await callback({ code: 'goog-code', state }, now);

    expect(result.redirectUrl).toContain('error=access_denied');
  });

  it('deep-links invalid_state when state is unknown', async () => {
    await setupCase({ approved: true });
    const stateRepo = new DrizzleMobileAuthStateRepository(db);
    const exchangeCodeRepo = new DrizzleMobileAuthExchangeCodeRepository(db);
    const userAccessRepo = new DrizzleUserAccessRepository(db);
    const google = new FakeGoogleOAuthClient();
    const callback = makeHandleMobileCallback({
      stateRepo,
      exchangeCodeRepo,
      userAccessRepo,
      google,
      crypto: new WebCryptoMobileAuthCrypto(),
      redirectUri: REDIRECT_URI,
    });

    const result = await callback({ code: 'goog-code', state: 'never-existed' }, new Date());
    expect(result.redirectUrl).toContain('error=invalid_state');
  });

  it('deep-links invalid_state when state row is expired', async () => {
    const now = new Date('2026-05-20T12:00:00Z');
    const stateRepo = new DrizzleMobileAuthStateRepository(db);
    const expiredState = await stateRepo.create({
      state: 'expired-state',
      codeChallenge: 'c',
      expiresAt: new Date(now.getTime() - 60_000),
    });

    const callback = makeHandleMobileCallback({
      stateRepo,
      exchangeCodeRepo: new DrizzleMobileAuthExchangeCodeRepository(db),
      userAccessRepo: new DrizzleUserAccessRepository(db),
      google: new FakeGoogleOAuthClient(),
      crypto: new WebCryptoMobileAuthCrypto(),
      redirectUri: REDIRECT_URI,
    });

    const result = await callback({ code: 'goog-code', state: expiredState.state }, now);
    expect(result.redirectUrl).toContain('error=invalid_state');
  });

  it('deep-links google_error when Google rejects the auth code', async () => {
    const { state, google, callback, now } = await setupCase({ approved: true });
    google.programme({ exchangeResult: { ok: false, error: 'invalid_grant' } });

    const result = await callback({ code: 'goog-code', state }, now);
    expect(result.redirectUrl).toContain('error=google_error');
  });

  it('marks state consumed on successful callback (replay safety)', async () => {
    const { state, google, callback, now, email } = await setupCase({ approved: true });
    google.withProfile({ googleId: 'g123', email, name: 'Matt' });
    await callback({ code: 'goog-code', state }, now);

    const stateRepo = new DrizzleMobileAuthStateRepository(db);
    const after = await stateRepo.findByState(state);
    expect(after?.consumedAt).not.toBeNull();

    // Replay: second call against the same (now-consumed) state.
    const replay = await callback({ code: 'goog-code', state }, now);
    expect(replay.redirectUrl).toContain('error=invalid_state');
  });
});
