import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { WebCryptoMobileAuthCrypto } from '@/infrastructure/auth/mobile-auth-crypto';
import { DrizzleMobileAuthExchangeCodeRepository } from '@/infrastructure/db/repositories/drizzle-mobile-auth-exchange-code-repository';
import { DrizzleMobileAuthStateRepository } from '@/infrastructure/db/repositories/drizzle-mobile-auth-state-repository';
import { DrizzleUserAccessRepository } from '@/infrastructure/db/repositories/drizzle-user-access-repository';
import {
  createTestDb,
  type Db,
  type Sql,
  seedUser,
  truncateAll,
} from '@/infrastructure/testing/helpers';
import { makeMintTestExchangeCode } from './mint-test-exchange-code';

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

const CHALLENGE = 'challenge-from-the-mobile-client-pkce-start-step-x';

function build() {
  const stateRepo = new DrizzleMobileAuthStateRepository(db);
  const exchangeCodeRepo = new DrizzleMobileAuthExchangeCodeRepository(db);
  const userAccessRepo = new DrizzleUserAccessRepository(db);
  const cryptoImpl = new WebCryptoMobileAuthCrypto();
  const mint = makeMintTestExchangeCode({
    stateRepo,
    exchangeCodeRepo,
    userAccessRepo,
    crypto: cryptoImpl,
  });
  return { stateRepo, exchangeCodeRepo, cryptoImpl, mint };
}

function codeFrom(redirectUrl: string): string | null {
  const q = redirectUrl.indexOf('?');
  if (q === -1) return null;
  return new URLSearchParams(redirectUrl.slice(q + 1)).get('code');
}

function errorFrom(redirectUrl: string): string | null {
  const q = redirectUrl.indexOf('?');
  if (q === -1) return null;
  return new URLSearchParams(redirectUrl.slice(q + 1)).get('error');
}

describe('mintTestExchangeCode', () => {
  it('mints a one-time code keyed to the state challenge for an approved user', async () => {
    const now = new Date('2026-06-13T12:00:00Z');
    const email = 'mint-approved@example.test';
    await seedUser(db, { email, isApproved: true });

    const { stateRepo, exchangeCodeRepo, cryptoImpl, mint } = build();
    const stateRow = await stateRepo.create({
      state: 'state-mint-ok',
      codeChallenge: CHALLENGE,
      expiresAt: new Date(now.getTime() + 60_000),
    });

    const { redirectUrl } = await mint({ state: stateRow.state, email }, now);

    const code = codeFrom(redirectUrl);
    expect(redirectUrl).toMatch(/^travelplanner:\/\/auth\?code=/);
    expect(code).toBeTruthy();

    // The minted row carries the state's challenge so /exchange can verify it.
    const codeHash = await cryptoImpl.sha256Base64url(code as string);
    const row = await exchangeCodeRepo.findByCodeHash(codeHash);
    expect(row?.codeChallenge).toBe(CHALLENGE);
    expect(row?.consumedAt).toBeNull();

    // State is single-use — consumed after minting.
    const consumed = await stateRepo.findByState(stateRow.state);
    expect(consumed?.consumedAt).not.toBeNull();
  });

  it('returns ?error=invalid_state for an unknown state', async () => {
    const { mint } = build();
    const { redirectUrl } = await mint(
      { state: 'never-existed', email: 'whoever@example.test' },
      new Date(),
    );
    expect(errorFrom(redirectUrl)).toBe('invalid_state');
  });

  it('returns ?error=invalid_state for an expired state', async () => {
    const now = new Date('2026-06-13T12:00:00Z');
    await seedUser(db, { email: 'expired@example.test', isApproved: true });
    const { stateRepo, mint } = build();
    const stateRow = await stateRepo.create({
      state: 'state-expired',
      codeChallenge: CHALLENGE,
      expiresAt: new Date(now.getTime() - 1_000),
    });

    const { redirectUrl } = await mint(
      { state: stateRow.state, email: 'expired@example.test' },
      now,
    );
    expect(errorFrom(redirectUrl)).toBe('invalid_state');
  });

  it('returns ?error=invalid_state for an already-consumed state', async () => {
    const now = new Date('2026-06-13T12:00:00Z');
    await seedUser(db, { email: 'twice@example.test', isApproved: true });
    const { stateRepo, mint } = build();
    const stateRow = await stateRepo.create({
      state: 'state-twice',
      codeChallenge: CHALLENGE,
      expiresAt: new Date(now.getTime() + 60_000),
    });

    await mint({ state: stateRow.state, email: 'twice@example.test' }, now);
    const second = await mint({ state: stateRow.state, email: 'twice@example.test' }, now);
    expect(errorFrom(second.redirectUrl)).toBe('invalid_state');
  });

  it('returns ?error=access_denied for an unapproved user and mints no code', async () => {
    const now = new Date('2026-06-13T12:00:00Z');
    const email = 'pending@example.test';
    await seedUser(db, { email, isApproved: false });

    const { stateRepo, exchangeCodeRepo, cryptoImpl, mint } = build();
    const stateRow = await stateRepo.create({
      state: 'state-unapproved',
      codeChallenge: CHALLENGE,
      expiresAt: new Date(now.getTime() + 60_000),
    });

    const { redirectUrl } = await mint({ state: stateRow.state, email }, now);
    expect(errorFrom(redirectUrl)).toBe('access_denied');

    // No code minted — a probe with any hash finds nothing for this challenge.
    const anyHash = await cryptoImpl.sha256Base64url('whatever');
    expect(await exchangeCodeRepo.findByCodeHash(anyHash)).toBeNull();
  });

  it('returns ?error=access_denied when the user does not exist', async () => {
    const now = new Date('2026-06-13T12:00:00Z');
    const { stateRepo, mint } = build();
    const stateRow = await stateRepo.create({
      state: 'state-no-user',
      codeChallenge: CHALLENGE,
      expiresAt: new Date(now.getTime() + 60_000),
    });

    const { redirectUrl } = await mint({ state: stateRow.state, email: 'ghost@example.test' }, now);
    expect(errorFrom(redirectUrl)).toBe('access_denied');
  });
});
