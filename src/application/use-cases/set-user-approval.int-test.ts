import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { DrizzleUserAccessRepository } from '@/infrastructure/db/repositories/drizzle-user-access-repository';
import {
  createTestDb,
  type Db,
  type Sql,
  seedUser,
  truncateAll,
} from '@/infrastructure/testing/helpers';
import { setUserApproval } from './set-user-approval';

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

describe('setUserApproval', () => {
  it('lets admins approve another user', async () => {
    const admin = await seedUser(db, {
      email: 'admin@example.com',
      isApproved: true,
      isAdmin: true,
    });
    const target = await seedUser(db, {
      email: 'target@example.com',
      isApproved: false,
      isAdmin: false,
    });

    const repository = new DrizzleUserAccessRepository(db);
    const result = await setUserApproval(repository, {
      actorUserId: admin.id,
      targetUserId: target.id,
      isApproved: true,
    });

    expect(result).toEqual({ ok: true, value: undefined });
    const updated = await repository.findById(target.id);
    expect(updated?.isApproved).toBe(true);
  });

  it('rejects non-admin actors', async () => {
    const actor = await seedUser(db, {
      email: 'member@example.com',
      isApproved: true,
      isAdmin: false,
    });
    const target = await seedUser(db, {
      email: 'target@example.com',
      isApproved: false,
      isAdmin: false,
    });

    const repository = new DrizzleUserAccessRepository(db);
    const result = await setUserApproval(repository, {
      actorUserId: actor.id,
      targetUserId: target.id,
      isApproved: true,
    });

    expect(result).toEqual({ ok: false, error: 'Forbidden' });
  });

  it('prevents users from revoking their own access', async () => {
    const admin = await seedUser(db, {
      email: 'admin@example.com',
      isApproved: true,
      isAdmin: true,
    });

    const repository = new DrizzleUserAccessRepository(db);
    const result = await setUserApproval(repository, {
      actorUserId: admin.id,
      targetUserId: admin.id,
      isApproved: false,
    });

    expect(result).toEqual({ ok: false, error: 'You cannot revoke your own access' });
  });
});
