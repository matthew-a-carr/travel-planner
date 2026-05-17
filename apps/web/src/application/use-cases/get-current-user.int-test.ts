import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { DrizzleUserAccessRepository } from '@/infrastructure/db/repositories/drizzle-user-access-repository';
import {
  createTestDb,
  type Db,
  type Sql,
  seedUser,
  truncateAll,
} from '@/infrastructure/testing/helpers';
import { getCurrentUser } from './get-current-user';

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

describe('getCurrentUser', () => {
  it('returns the user when the session points to an approved row', async () => {
    const { id } = await seedUser(db, {
      email: 'approved@example.com',
      name: 'Approved User',
      isApproved: true,
    });

    const result = await getCurrentUser(new DrizzleUserAccessRepository(db), id);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.id).toBe(id);
      expect(result.value.email).toBe('approved@example.com');
      expect(result.value.isApproved).toBe(true);
    }
  });

  it('errors with "unauthenticated" when no session user id is supplied', async () => {
    const result = await getCurrentUser(new DrizzleUserAccessRepository(db), null);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('unauthenticated');
  });

  it('errors with "user_not_found" when the session points to a missing row', async () => {
    const result = await getCurrentUser(
      new DrizzleUserAccessRepository(db),
      'non-existent-user-id',
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('user_not_found');
  });

  it('errors with "unapproved" when the user row exists but isApproved is false', async () => {
    const { id } = await seedUser(db, {
      email: 'pending@example.com',
      isApproved: false,
    });

    const result = await getCurrentUser(new DrizzleUserAccessRepository(db), id);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('unapproved');
  });
});
