import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { auth } from '@/infrastructure/auth';
import {
  createTestDb,
  type Db,
  type Sql,
  seedUser,
  truncateAll,
} from '@/infrastructure/testing/helpers';

// Replace next-auth's `auth()` with a stub. The handler we're testing is
// a thin glue layer: it calls auth(), passes the session user id to the
// use case, and maps the Result to a Response. The use case has its own
// integration tests against real Postgres; here we verify the glue.
vi.mock('@/infrastructure/auth', () => ({
  auth: vi.fn(),
}));

// `getAppContainer()` resolves repositories from the global db proxy
// (`apps/web/src/infrastructure/db/client.ts`). Tests share the same
// Postgres URL via globalSetup, so the container's repositories operate
// on the same database as the test's own connection.

const authMock = vi.mocked(auth);

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
  authMock.mockReset();
});

async function callMe(): Promise<Response> {
  // Import lazily so the auth mock is wired up before the handler module
  // captures the `auth` reference at import time.
  const { GET } = await import('./route');
  return GET();
}

function mockSession(userId: string | null): void {
  if (userId === null) {
    authMock.mockResolvedValue(null as never);
  } else {
    authMock.mockResolvedValue({
      user: { id: userId, email: 'session@example.com', isApproved: true },
      expires: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    } as never);
  }
}

describe('GET /api/v1/me', () => {
  it('returns 200 and the serialised user shape for an approved session', async () => {
    const { id } = await seedUser(db, {
      email: 'approved@example.com',
      name: 'Approved User',
      firstName: 'Approved',
      lastName: 'User',
      isApproved: true,
    });
    mockSession(id);

    const response = await callMe();

    expect(response.status).toBe(200);
    const body = (await response.json()) as Record<string, unknown>;
    expect(body).toMatchObject({
      id,
      email: 'approved@example.com',
      name: 'Approved User',
      firstName: 'Approved',
      lastName: 'User',
      isApproved: true,
      isAdmin: false,
    });
    expect(typeof body.createdAt).toBe('string');
    expect(() => new Date(body.createdAt as string).toISOString()).not.toThrow();
  });

  it('returns 401 with "unauthenticated" code when there is no session', async () => {
    mockSession(null);

    const response = await callMe();

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      error: { code: 'unauthenticated', message: 'Authentication required.' },
    });
  });

  it('returns 401 with "unauthenticated" code when the session points to a missing user row', async () => {
    mockSession('non-existent-user-id');

    const response = await callMe();

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      error: { code: 'unauthenticated', message: 'Authentication required.' },
    });
  });

  it('returns 403 with "account_pending_approval" when the user exists but is not approved', async () => {
    const { id } = await seedUser(db, {
      email: 'pending@example.com',
      isApproved: false,
    });
    mockSession(id);

    const response = await callMe();

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      error: { code: 'account_pending_approval', message: 'Account is pending approval.' },
    });
  });

  it('includes isAdmin: true for an approved admin user', async () => {
    const { id } = await seedUser(db, {
      email: 'admin@example.com',
      isApproved: true,
      isAdmin: true,
    });
    mockSession(id);

    const response = await callMe();

    expect(response.status).toBe(200);
    const body = (await response.json()) as { isAdmin: boolean };
    expect(body.isAdmin).toBe(true);
  });
});
