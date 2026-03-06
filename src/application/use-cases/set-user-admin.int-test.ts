import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { DrizzleUserAccessRepository } from '@/infrastructure/db/repositories/drizzle-user-access-repository';
import {
  createTestDb,
  type Db,
  type Sql,
  seedUser,
  truncateAll,
} from '@/infrastructure/testing/helpers';
import { setUserAdmin } from './set-user-admin';

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

describe('setUserAdmin', () => {
  it('lets admins promote another user and auto-approves them', async () => {
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
    const result = await setUserAdmin(repository, {
      actorUserId: admin.id,
      targetUserId: target.id,
      isAdmin: true,
    });

    expect(result).toEqual({ ok: true, value: undefined });
    const updated = await repository.findById(target.id);
    expect(updated?.isAdmin).toBe(true);
    expect(updated?.isApproved).toBe(true);
  });

  it('rejects self-demotion', async () => {
    const admin = await seedUser(db, {
      email: 'admin@example.com',
      isApproved: true,
      isAdmin: true,
    });

    const repository = new DrizzleUserAccessRepository(db);
    const result = await setUserAdmin(repository, {
      actorUserId: admin.id,
      targetUserId: admin.id,
      isAdmin: false,
    });

    expect(result).toEqual({ ok: false, error: 'You cannot remove your own admin access' });
  });

  it('rejects when actor is not admin', async () => {
    const actor = await seedUser(db, {
      email: 'member@example.com',
      isApproved: true,
      isAdmin: false,
    });
    const target = await seedUser(db, {
      email: 'target@example.com',
      isApproved: true,
      isAdmin: false,
    });

    const repository = new DrizzleUserAccessRepository(db);
    const result = await setUserAdmin(repository, {
      actorUserId: actor.id,
      targetUserId: target.id,
      isAdmin: true,
    });

    expect(result).toEqual({ ok: false, error: 'Forbidden' });
  });
});
