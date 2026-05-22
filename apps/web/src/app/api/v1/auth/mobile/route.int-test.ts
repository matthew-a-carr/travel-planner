/**
 * Route-level integration tests for the four /api/v1/auth/mobile/*
 * endpoints. Use-case-level integration tests (in the use-case dirs)
 * cover the business logic; these tests focus on the HTTP layer:
 * zod parsing, envelope shape, status codes, and container wiring.
 *
 * Each test rebuilds the AppContainer with overrides for the Google
 * OAuth client (uses FakeGoogleOAuthClient) so we don't hit real
 * Google. Repos + crypto are real, backed by Testcontainers.
 */

import {
  apiErrorBodySchema,
  mobileAuthCallbackErrorSchema,
  mobileAuthExchangeResponseSchema,
  mobileAuthStartResponseSchema,
} from '@travel-planner/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { WebCryptoMobileAuthCrypto } from '@/infrastructure/auth/mobile-auth-crypto';
import {
  type CreateTestAppContainerInput,
  createTestAppContainer,
} from '@/infrastructure/container/create-test-app-container';
import { DrizzleMobileAuthExchangeCodeRepository } from '@/infrastructure/db/repositories/drizzle-mobile-auth-exchange-code-repository';
import { DrizzleMobileAuthStateRepository } from '@/infrastructure/db/repositories/drizzle-mobile-auth-state-repository';
import { DrizzleRefreshTokenRepository } from '@/infrastructure/db/repositories/drizzle-refresh-token-repository';
import { FakeGoogleOAuthClient } from '@/infrastructure/testing/fake-google-oauth-client';
import {
  createTestDb,
  type Db,
  type Sql,
  seedUser,
  truncateAll,
} from '@/infrastructure/testing/helpers';

/**
 * Extract the `error` query parameter from a `travelplanner://auth?...`
 * deep-link URL. Returns undefined if no error param is present (happy
 * path) so the caller can pass it to mobileAuthCallbackErrorSchema.parse
 * only when expected.
 */
function callbackErrorParam(location: string | null): string | undefined {
  if (!location) return undefined;
  // The custom scheme isn't a recognised URL protocol everywhere; parse
  // the query manually.
  const queryStart = location.indexOf('?');
  if (queryStart === -1) return undefined;
  const params = new URLSearchParams(location.slice(queryStart + 1));
  return params.get('error') ?? undefined;
}

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

/**
 * Builds a fresh container per test with a fake Google client and
 * publishes it as the global singleton via dynamic import-cache
 * manipulation. Returns the fake so each test can programme it.
 */
async function withFakeContainer(
  fake: FakeGoogleOAuthClient,
): Promise<{ container: ReturnType<typeof createTestAppContainer> }> {
  const overrides: Partial<CreateTestAppContainerInput['overrides']> = {
    googleOAuthClient: fake,
  };
  const container = createTestAppContainer({
    dbClient: db,
    overrides: overrides as CreateTestAppContainerInput['overrides'],
  });

  vi.resetModules();
  vi.doMock('@/infrastructure/db/client', () => ({ db }));
  vi.doMock('@/infrastructure/container', async () => {
    return {
      getAppContainer: () => container,
    };
  });

  return { container };
}

describe('/api/v1/auth/mobile/start', () => {
  it('400s on missing code_challenge', async () => {
    const { POST } = await import('./start/route');

    const res = await POST(
      new Request('http://localhost/api/v1/auth/mobile/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    apiErrorBodySchema.parse(body);
    expect(body.error.code).toBe('validation_failed');
  });

  it('returns 200 with authorise_url + state', async () => {
    const fake = new FakeGoogleOAuthClient();
    await withFakeContainer(fake);
    const { POST } = await import('./start/route');

    const cryptoImpl = new WebCryptoMobileAuthCrypto();
    const challenge = await cryptoImpl.sha256Base64url('verifier-x'.repeat(5));

    const res = await POST(
      new Request('http://localhost/api/v1/auth/mobile/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code_challenge: challenge }),
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    mobileAuthStartResponseSchema.parse(body);
    expect(body.authorise_url).toContain('accounts.google.test');
    expect(body.state).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });
});

describe('/api/v1/auth/mobile/callback', () => {
  it('302 redirects to deep link with one-time code on happy path', async () => {
    const user = await seedUser(db, {
      email: 'matt@example.com',
      isApproved: true,
    });
    const fake = new FakeGoogleOAuthClient();
    fake.withProfile({ googleId: 'g123', email: 'matt@example.com', name: 'Matt' });
    await withFakeContainer(fake);

    // Seed a state row directly.
    const stateRepo = new DrizzleMobileAuthStateRepository(db);
    const stateRow = await stateRepo.create({
      state: 'state-good',
      codeChallenge: 'chal',
      expiresAt: new Date(Date.now() + 60_000),
    });
    expect(user.id).toBeTruthy();

    const { GET } = await import('./callback/route');
    const res = await GET(
      new Request(`http://localhost/api/v1/auth/mobile/callback?code=goog&state=${stateRow.state}`),
    );
    expect(res.status).toBe(302);
    const location = res.headers.get('location');
    expect(location).toMatch(/^travelplanner:\/\/auth\?code=/);
  });

  it('redirects with error=access_denied for unapproved user', async () => {
    await seedUser(db, { email: 'stranger@example.com', isApproved: false });
    const fake = new FakeGoogleOAuthClient();
    fake.withProfile({ googleId: 'g999', email: 'stranger@example.com', name: null });
    await withFakeContainer(fake);

    const stateRepo = new DrizzleMobileAuthStateRepository(db);
    const stateRow = await stateRepo.create({
      state: 'state-bad-user',
      codeChallenge: 'chal',
      expiresAt: new Date(Date.now() + 60_000),
    });

    const { GET } = await import('./callback/route');
    const res = await GET(
      new Request(`http://localhost/api/v1/auth/mobile/callback?code=goog&state=${stateRow.state}`),
    );
    expect(res.status).toBe(302);
    const accessDeniedLocation = res.headers.get('location');
    expect(accessDeniedLocation).toContain('error=access_denied');
    expect(mobileAuthCallbackErrorSchema.parse(callbackErrorParam(accessDeniedLocation))).toBe(
      'access_denied',
    );
  });

  it('redirects with invalid_request when code or state is missing', async () => {
    await withFakeContainer(new FakeGoogleOAuthClient());
    const { GET } = await import('./callback/route');
    const res = await GET(new Request('http://localhost/api/v1/auth/mobile/callback'));
    expect(res.status).toBe(302);
    const invalidRequestLocation = res.headers.get('location');
    expect(invalidRequestLocation).toContain('error=invalid_request');
    expect(mobileAuthCallbackErrorSchema.parse(callbackErrorParam(invalidRequestLocation))).toBe(
      'invalid_request',
    );
  });
});

describe('/api/v1/auth/mobile/exchange', () => {
  it('happy path: mints access + refresh', async () => {
    const cryptoImpl = new WebCryptoMobileAuthCrypto();
    const user = await seedUser(db, { isApproved: true });
    const verifier = cryptoImpl.randomBase64url(32);
    const challenge = await cryptoImpl.sha256Base64url(verifier);

    // Seed an exchange-code row.
    const codeRepo = new DrizzleMobileAuthExchangeCodeRepository(db);
    const cleartext = cryptoImpl.randomBase64url(32);
    const codeHash = await cryptoImpl.sha256Base64url(cleartext);
    await codeRepo.create({
      codeHash,
      codeChallenge: challenge,
      userId: user.id,
      expiresAt: new Date(Date.now() + 60_000),
    });

    await withFakeContainer(new FakeGoogleOAuthClient());
    const { POST } = await import('./exchange/route');
    const res = await POST(
      new Request('http://localhost/api/v1/auth/mobile/exchange', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: cleartext, code_verifier: verifier }),
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    mobileAuthExchangeResponseSchema.parse(body);
    expect(typeof body.access_token).toBe('string');
    expect(typeof body.refresh_token).toBe('string');
    expect(typeof body.access_expires_at).toBe('string');
  });

  it('400 pkce_mismatch when verifier does not match', async () => {
    const cryptoImpl = new WebCryptoMobileAuthCrypto();
    const user = await seedUser(db, { isApproved: true });
    const codeRepo = new DrizzleMobileAuthExchangeCodeRepository(db);
    const cleartext = cryptoImpl.randomBase64url(32);
    const codeHash = await cryptoImpl.sha256Base64url(cleartext);
    await codeRepo.create({
      codeHash,
      codeChallenge: await cryptoImpl.sha256Base64url('real-verifier'.repeat(4)),
      userId: user.id,
      expiresAt: new Date(Date.now() + 60_000),
    });

    await withFakeContainer(new FakeGoogleOAuthClient());
    const { POST } = await import('./exchange/route');
    const res = await POST(
      new Request('http://localhost/api/v1/auth/mobile/exchange', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: cleartext,
          code_verifier: 'wrong-verifier'.repeat(4),
        }),
      }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    apiErrorBodySchema.parse(body);
    expect(body.error.code).toBe('pkce_mismatch');
  });
});

describe('/api/v1/auth/mobile/refresh', () => {
  it('401 refresh_unknown for unknown token', async () => {
    await withFakeContainer(new FakeGoogleOAuthClient());
    const { POST } = await import('./refresh/route');
    const res = await POST(
      new Request('http://localhost/api/v1/auth/mobile/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: 'never-existed' }),
      }),
    );
    expect(res.status).toBe(401);
    const body = await res.json();
    apiErrorBodySchema.parse(body);
    expect(body.error.code).toBe('refresh_unknown');
  });

  it('400 validation_failed when body is empty', async () => {
    await withFakeContainer(new FakeGoogleOAuthClient());
    const { POST } = await import('./refresh/route');
    const res = await POST(
      new Request('http://localhost/api/v1/auth/mobile/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    apiErrorBodySchema.parse(body);
    expect(body.error.code).toBe('validation_failed');
  });
});

describe('/api/v1/auth/mobile/revoke', () => {
  const HOUR_MS = 60 * 60 * 1000;

  it('204 + marks the presented row revoked_at when given a valid token', async () => {
    await withFakeContainer(new FakeGoogleOAuthClient());
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

    const { POST } = await import('./revoke/route');
    const res = await POST(
      new Request('http://localhost/api/v1/auth/mobile/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: cleartext }),
      }),
    );

    expect(res.status).toBe(204);
    // 204 responses have no body — verify the read is empty.
    const text = await res.text();
    expect(text).toBe('');

    const row = await refreshTokenRepo.findByTokenHash(hash);
    expect(row?.revokedAt).not.toBeNull();
  });

  it('204 + idempotent on already-revoked token (earlier revoked_at preserved)', async () => {
    await withFakeContainer(new FakeGoogleOAuthClient());
    const cryptoImpl = new WebCryptoMobileAuthCrypto();
    const user = await seedUser(db, { isApproved: true });
    const firstAt = new Date('2026-05-22T10:00:00Z');

    const refreshTokenRepo = new DrizzleRefreshTokenRepository(db);
    const { cleartext, hash } = await cryptoImpl.mintRefreshToken();
    await refreshTokenRepo.create({
      userId: user.id,
      tokenHash: hash,
      issuedAt: firstAt,
      expiresAt: new Date(firstAt.getTime() + 30 * 24 * HOUR_MS),
    });

    const { POST } = await import('./revoke/route');

    // First revoke.
    const first = await POST(
      new Request('http://localhost/api/v1/auth/mobile/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: cleartext }),
      }),
    );
    expect(first.status).toBe(204);
    const firstRow = await refreshTokenRepo.findByTokenHash(hash);
    const firstRevokedAt = firstRow?.revokedAt;
    expect(firstRevokedAt).not.toBeNull();

    // Second revoke — same token, should be 204 and not change revoked_at.
    const second = await POST(
      new Request('http://localhost/api/v1/auth/mobile/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: cleartext }),
      }),
    );
    expect(second.status).toBe(204);
    const secondRow = await refreshTokenRepo.findByTokenHash(hash);
    expect(secondRow?.revokedAt?.getTime()).toBe(firstRevokedAt?.getTime());
  });

  it('204 for unknown / never-existed token (no leakage)', async () => {
    await withFakeContainer(new FakeGoogleOAuthClient());

    const { POST } = await import('./revoke/route');
    const res = await POST(
      new Request('http://localhost/api/v1/auth/mobile/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: 'never-existed-cleartext' }),
      }),
    );
    expect(res.status).toBe(204);
  });

  it('400 validation_failed on missing refresh_token field', async () => {
    await withFakeContainer(new FakeGoogleOAuthClient());

    const { POST } = await import('./revoke/route');
    const res = await POST(
      new Request('http://localhost/api/v1/auth/mobile/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    apiErrorBodySchema.parse(body);
    expect(body.error.code).toBe('validation_failed');
  });

  it('400 validation_failed on empty refresh_token string', async () => {
    await withFakeContainer(new FakeGoogleOAuthClient());

    const { POST } = await import('./revoke/route');
    const res = await POST(
      new Request('http://localhost/api/v1/auth/mobile/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: '' }),
      }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    apiErrorBodySchema.parse(body);
    expect(body.error.code).toBe('validation_failed');
  });

  it('cross-endpoint: /refresh after /revoke returns 401 refresh_revoked', async () => {
    await withFakeContainer(new FakeGoogleOAuthClient());
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

    // Sign-out via /revoke.
    const { POST: revokePOST } = await import('./revoke/route');
    const revokeRes = await revokePOST(
      new Request('http://localhost/api/v1/auth/mobile/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: cleartext }),
      }),
    );
    expect(revokeRes.status).toBe(204);

    // Try to use the same refresh token.
    const { POST: refreshPOST } = await import('./refresh/route');
    const refreshRes = await refreshPOST(
      new Request('http://localhost/api/v1/auth/mobile/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: cleartext }),
      }),
    );
    expect(refreshRes.status).toBe(401);
    const body = await refreshRes.json();
    apiErrorBodySchema.parse(body);
    expect(body.error.code).toBe('refresh_revoked');

    // Verify the row carries revoked_at after revoke.
    const row = await refreshTokenRepo.findByTokenHash(hash);
    expect(row?.revokedAt).not.toBeNull();
  });

  it('cross-endpoint: /refresh on an un-revoked predecessor triggers reuse-detection', async () => {
    await withFakeContainer(new FakeGoogleOAuthClient());
    const cryptoImpl = new WebCryptoMobileAuthCrypto();
    const user = await seedUser(db, { isApproved: true });
    const t0 = new Date('2026-05-22T10:00:00Z');

    // Seed the original refresh token.
    const refreshTokenRepo = new DrizzleRefreshTokenRepository(db);
    const { cleartext: original, hash: originalHash } = await cryptoImpl.mintRefreshToken();
    await refreshTokenRepo.create({
      userId: user.id,
      tokenHash: originalHash,
      issuedAt: t0,
      expiresAt: new Date(t0.getTime() + 30 * 24 * HOUR_MS),
    });

    // Rotate normally via /refresh — `original` becomes predecessor.
    const { POST: refreshPOST } = await import('./refresh/route');
    const rotateRes = await refreshPOST(
      new Request('http://localhost/api/v1/auth/mobile/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: original }),
      }),
    );
    expect(rotateRes.status).toBe(200);
    const rotated = mobileAuthExchangeResponseSchema.parse(await rotateRes.json());

    // Sign out the active head via /revoke.
    const { POST: revokePOST } = await import('./revoke/route');
    const revokeRes = await revokePOST(
      new Request('http://localhost/api/v1/auth/mobile/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: rotated.refresh_token }),
      }),
    );
    expect(revokeRes.status).toBe(204);

    // Predecessor (`original`) was rotated but NOT explicitly revoked by /revoke.
    // Presenting it should trigger reuse-detection in /refresh.
    const reuseRes = await refreshPOST(
      new Request('http://localhost/api/v1/auth/mobile/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: original }),
      }),
    );
    expect(reuseRes.status).toBe(401);
    const reuseBody = await reuseRes.json();
    apiErrorBodySchema.parse(reuseBody);
    expect(reuseBody.error.code).toBe('refresh_reused');
  });
});
