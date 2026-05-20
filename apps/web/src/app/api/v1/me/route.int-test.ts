import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createTestDb,
  type Db,
  type Sql,
  seedUser,
  truncateAll,
} from '@/infrastructure/testing/helpers';

// Mock next-auth's auth() so each test can control the session shape.
// Everything else (db lookups, anonymisation detection, error envelope) runs
// against real code paths and a real Postgres via Testcontainers.
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
});

describe('GET /api/v1/me', () => {
  it('returns 200 with the user shape for an approved user', async () => {
    const user = await seedUser(db, {
      email: 'matt@example.com',
      name: 'Matt Carr',
      isApproved: true,
    });
    mockedAuth.mockResolvedValue({
      user: { id: user.id, email: 'matt@example.com', name: 'Matt Carr' },
    });

    const response = await GET();

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

    const response = await GET();

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

    const response = await GET();

    expect(response.status).toBe(410);
    const body = (await response.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe('user_deleted');
    expect(typeof body.error.message).toBe('string');
  });

  it('returns 401 unauthenticated when there is no session', async () => {
    mockedAuth.mockResolvedValue(null);

    const response = await GET();

    expect(response.status).toBe(401);
    const body = (await response.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe('unauthenticated');
  });

  it('returns 401 unauthenticated when the session points at a user that no longer exists', async () => {
    const ghostId = crypto.randomUUID();
    mockedAuth.mockResolvedValue({
      user: { id: ghostId, email: 'ghost@example.com', name: 'Ghost' },
    });
    // Intentionally no seedUser — the session references a nonexistent row.

    const response = await GET();

    expect(response.status).toBe(401);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe('unauthenticated');
  });

  it('returns 500 internal with a generic envelope when an unexpected error occurs', async () => {
    mockedAuth.mockImplementation(async () => {
      throw new Error('boom from auth()');
    });

    const response = await GET();

    expect(response.status).toBe(500);
    const body = (await response.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe('internal');
    // Internals must not leak.
    expect(JSON.stringify(body)).not.toContain('boom from auth()');
  });
});
