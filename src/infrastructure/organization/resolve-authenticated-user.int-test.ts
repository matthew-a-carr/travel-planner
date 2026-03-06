import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { users } from '@/infrastructure/db/schema';
import {
  createTestDb,
  type Db,
  type Sql,
  seedUser,
  truncateAll,
} from '@/infrastructure/testing/helpers';
import { resolveAuthenticatedUserId } from './resolve-authenticated-user';

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

describe('resolveAuthenticatedUserId', () => {
  it('returns the session user id when that user exists', async () => {
    const seeded = await seedUser(db, {
      id: 'session-user-id',
      email: 'existing@example.com',
      name: 'Existing User',
    });

    const resolved = await resolveAuthenticatedUserId(db, {
      id: seeded.id,
      email: seeded.email,
      name: 'Existing User',
    });

    expect(resolved).toBe(seeded.id);
  });

  it('falls back to existing user by email when session id is stale', async () => {
    const seeded = await seedUser(db, {
      id: 'canonical-id',
      email: 'local-dev@travel-planner.local',
      name: 'Local Dev User',
    });

    const resolved = await resolveAuthenticatedUserId(db, {
      id: 'stale-session-id',
      email: 'LOCAL-DEV@TRAVEL-PLANNER.LOCAL',
      name: 'Local Dev User',
    });

    expect(resolved).toBe(seeded.id);
  });

  it('creates a user with the session id when no matching user exists', async () => {
    const resolved = await resolveAuthenticatedUserId(db, {
      id: 'new-session-id',
      email: 'fresh@example.com',
      name: 'Fresh User',
    });

    expect(resolved).toBe('new-session-id');

    const inserted = await db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(eq(users.id, 'new-session-id'))
      .limit(1);

    expect(inserted[0]).toEqual({
      id: 'new-session-id',
      email: 'fresh@example.com',
    });
  });

  it('returns null when no user id and no email are available', async () => {
    const resolved = await resolveAuthenticatedUserId(db, {
      id: null,
      email: null,
      name: null,
    });

    expect(resolved).toBeNull();
  });
});
