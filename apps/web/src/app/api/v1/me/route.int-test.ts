import { SignJWT } from 'jose';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { signAccessToken } from '@/infrastructure/auth/bearer-token';
import {
  createTestDb,
  type Db,
  type Sql,
  seedUser,
  truncateAll,
} from '@/infrastructure/testing/helpers';

// Mock next-auth's auth() so each test can control the cookie-session shape.
// Bearer tokens are minted via the real signAccessToken; everything else
// (db lookups, anonymisation detection, error envelope) runs against real
// code paths and a real Postgres via Testcontainers.
vi.mock('@/infrastructure/auth', () => ({
  auth: vi.fn(),
}));

import { auth } from '@/infrastructure/auth';
import { GET } from './route';

// next-auth's `auth` is overloaded (no-args session / middleware / handler).
// `vi.mocked(auth)` resolves to the widest overload and trips on .mockResolvedValue.
// This narrow alias targets just the no-args session shape that the helper uses.
type MockSession = { user: { id: string; email: string; name: string } } | null;
type MockedAuth = {
  mockResolvedValue: (value: MockSession) => void;
  mockImplementation: (impl: () => Promise<MockSession>) => void;
  mockReset: () => void;
};
const mockedAuth = auth as unknown as MockedAuth;

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
  mockedAuth.mockReset();
  // Default: no cookie session. Tests that need one call mockedAuth.mockResolvedValue(...).
  mockedAuth.mockResolvedValue(null);
});

function requestWithBearer(jwt: string): Request {
  return new Request('http://localhost/api/v1/me', {
    headers: { Authorization: `Bearer ${jwt}` },
  });
}

function requestWithoutAuth(): Request {
  return new Request('http://localhost/api/v1/me');
}

describe('GET /api/v1/me — cookie path', () => {
  it('returns 200 with the user shape for an approved user', async () => {
    const user = await seedUser(db, {
      email: 'matt@example.com',
      name: 'Matt Carr',
      isApproved: true,
    });
    mockedAuth.mockResolvedValue({
      user: { id: user.id, email: 'matt@example.com', name: 'Matt Carr' },
    });

    const response = await GET(requestWithoutAuth());

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual({
      id: user.id,
      email: 'matt@example.com',
      name: 'Matt Carr',
      isApproved: true,
    });
  });

  it('returns 200 with isApproved:false for an authenticated-but-unapproved user', async () => {
    const user = await seedUser(db, {
      email: 'pending@example.com',
      name: 'Pending User',
      isApproved: false,
    });
    mockedAuth.mockResolvedValue({
      user: { id: user.id, email: 'pending@example.com', name: 'Pending User' },
    });

    const response = await GET(requestWithoutAuth());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      id: user.id,
      email: 'pending@example.com',
      name: 'Pending User',
      isApproved: false,
    });
  });

  it('returns 410 user_deleted for an anonymised user (ADR 031 email marker)', async () => {
    const userId = crypto.randomUUID();
    const anonymisedEmail = `deleted-${userId}@anonymized.local`;
    await seedUser(db, {
      id: userId,
      email: anonymisedEmail,
      name: 'Anonymised',
      isApproved: false,
    });
    mockedAuth.mockResolvedValue({
      user: { id: userId, email: anonymisedEmail, name: 'Anonymised' },
    });

    const response = await GET(requestWithoutAuth());

    expect(response.status).toBe(410);
    const body = (await response.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe('user_deleted');
    expect(typeof body.error.message).toBe('string');
  });

  it('returns 401 unauthenticated when there is no session', async () => {
    const response = await GET(requestWithoutAuth());

    expect(response.status).toBe(401);
    const body = (await response.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe('unauthenticated');
  });

  it('returns 401 unauthenticated when the session points at a user that no longer exists', async () => {
    const ghostId = crypto.randomUUID();
    mockedAuth.mockResolvedValue({
      user: { id: ghostId, email: 'ghost@example.com', name: 'Ghost' },
    });

    const response = await GET(requestWithoutAuth());

    expect(response.status).toBe(401);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe('unauthenticated');
  });

  it('returns 500 internal with a generic envelope when an unexpected error occurs', async () => {
    mockedAuth.mockImplementation(async () => {
      throw new Error('boom from auth()');
    });

    const response = await GET(requestWithoutAuth());

    expect(response.status).toBe(500);
    const body = (await response.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe('internal');
    expect(JSON.stringify(body)).not.toContain('boom from auth()');
  });
});

describe('GET /api/v1/me — bearer path', () => {
  it('returns 200 with the user shape for a valid bearer + approved user', async () => {
    const user = await seedUser(db, {
      email: 'mobile@example.com',
      name: 'Mobile Matt',
      isApproved: true,
    });
    const jwt = await signAccessToken({ userId: user.id });

    const response = await GET(requestWithBearer(jwt));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      id: user.id,
      email: 'mobile@example.com',
      name: 'Mobile Matt',
      isApproved: true,
    });
  });

  it('returns 200 with isApproved:false for a valid bearer + unapproved user', async () => {
    const user = await seedUser(db, {
      email: 'pending-mobile@example.com',
      name: 'Pending Mobile',
      isApproved: false,
    });
    const jwt = await signAccessToken({ userId: user.id });

    const response = await GET(requestWithBearer(jwt));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      isApproved: false,
    });
  });

  it('returns 410 user_deleted for a valid bearer pointing at an anonymised user', async () => {
    const userId = crypto.randomUUID();
    const anonymisedEmail = `deleted-${userId}@anonymized.local`;
    await seedUser(db, {
      id: userId,
      email: anonymisedEmail,
      name: 'Anonymised Mobile',
      isApproved: false,
    });
    const jwt = await signAccessToken({ userId });

    const response = await GET(requestWithBearer(jwt));

    expect(response.status).toBe(410);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe('user_deleted');
  });

  it('returns 401 for an expired bearer (no detail leaked)', async () => {
    const userId = crypto.randomUUID();
    await seedUser(db, { id: userId, email: 'live@example.com', isApproved: true });

    // Hand-sign with exp in the past (signAccessToken doesn't expose negative TTL).
    const key = new TextEncoder().encode(process.env.AUTH_JWT_SIGNING_KEY ?? '');
    const now = Math.floor(Date.now() / 1000);
    const expiredJwt = await new SignJWT({})
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(userId)
      .setIssuer('travel-planner-api')
      .setIssuedAt(now - 100)
      .setExpirationTime(now - 1)
      .sign(key);

    const response = await GET(requestWithBearer(expiredJwt));

    expect(response.status).toBe(401);
    const body = (await response.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe('unauthenticated');
    // Single unauthenticated code, no expired/invalid sub-codes leak.
    expect(JSON.stringify(body)).not.toContain('expired');
  });

  it('returns 401 for a malformed bearer', async () => {
    const response = await GET(requestWithBearer('not-a-jwt'));
    expect(response.status).toBe(401);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe('unauthenticated');
  });

  it('returns 401 for a bearer signed with a different key', async () => {
    const userId = crypto.randomUUID();
    await seedUser(db, { id: userId, email: 'live2@example.com', isApproved: true });

    const wrongKey = new TextEncoder().encode('different-signing-key-not-matching');
    const now = Math.floor(Date.now() / 1000);
    const badSigJwt = await new SignJWT({})
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(userId)
      .setIssuer('travel-planner-api')
      .setIssuedAt(now)
      .setExpirationTime(now + 60)
      .sign(wrongKey);

    const response = await GET(requestWithBearer(badSigJwt));

    expect(response.status).toBe(401);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe('unauthenticated');
  });
});

describe('GET /api/v1/me — bearer-wins when both are present', () => {
  it('uses the bearer user, not the cookie user, when both authenticate', async () => {
    const cookieUser = await seedUser(db, {
      email: 'cookie@example.com',
      name: 'Cookie User',
      isApproved: true,
    });
    const bearerUser = await seedUser(db, {
      email: 'bearer@example.com',
      name: 'Bearer User',
      isApproved: true,
    });

    mockedAuth.mockResolvedValue({
      user: { id: cookieUser.id, email: 'cookie@example.com', name: 'Cookie User' },
    });
    const jwt = await signAccessToken({ userId: bearerUser.id });

    const response = await GET(requestWithBearer(jwt));

    expect(response.status).toBe(200);
    const body = (await response.json()) as { id: string; email: string };
    expect(body.id).toBe(bearerUser.id);
    expect(body.email).toBe('bearer@example.com');
  });
});
