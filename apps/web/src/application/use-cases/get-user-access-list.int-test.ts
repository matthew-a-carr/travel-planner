import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { DrizzleUserAccessRepository } from '@/infrastructure/db/repositories/drizzle-user-access-repository';
import {
  createTestDb,
  type Db,
  type Sql,
  seedUser,
  truncateAll,
} from '@/infrastructure/testing/helpers';
import { getUserAccessList } from './get-user-access-list';

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

describe('getUserAccessList', () => {
  it('allows admins to list users', async () => {
    const admin = await seedUser(db, {
      email: 'admin@example.com',
      isApproved: true,
      isAdmin: true,
    });
    await seedUser(db, {
      email: 'member@example.com',
      isApproved: true,
      isAdmin: false,
    });

    const repository = new DrizzleUserAccessRepository(db);
    const result = await getUserAccessList(repository, admin.id);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toHaveLength(2);
  });

  it('rejects non-admin users', async () => {
    const member = await seedUser(db, {
      email: 'member@example.com',
      isApproved: true,
      isAdmin: false,
    });

    const repository = new DrizzleUserAccessRepository(db);
    const result = await getUserAccessList(repository, member.id);

    expect(result).toEqual({ ok: false, error: 'Forbidden' });
  });
});
