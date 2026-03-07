import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { DrizzleUserAccessRepository } from '@/infrastructure/db/repositories/drizzle-user-access-repository';
import {
  createTestDb,
  type Db,
  type Sql,
  seedUser,
  truncateAll,
} from '@/infrastructure/testing/helpers';
import { preProvisionUserAccess } from './pre-provision-user-access';

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

describe('preProvisionUserAccess (integration)', () => {
  it('admin can pre-provision an approved non-admin user', async () => {
    const admin = await seedUser(db, {
      email: 'admin@example.com',
      isApproved: true,
      isAdmin: true,
    });
    const repository = new DrizzleUserAccessRepository(db);

    const result = await preProvisionUserAccess(repository, {
      actorUserId: admin.id,
      email: 'new.member@example.com',
      name: 'New Member',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.isApproved).toBe(true);
    expect(result.value.isAdmin).toBe(false);
    expect(result.value.firstName).toBe('New');
    expect(result.value.lastName).toBe('Member');
  });

  it('is idempotent for existing canonicalized emails and sets approval', async () => {
    const admin = await seedUser(db, {
      email: 'admin@example.com',
      isApproved: true,
      isAdmin: true,
    });
    const existing = await seedUser(db, {
      email: 'carr.matty@gmail.com',
      isApproved: false,
      isAdmin: false,
      name: 'Legacy Name',
    });
    const repository = new DrizzleUserAccessRepository(db);

    const result = await preProvisionUserAccess(repository, {
      actorUserId: admin.id,
      email: 'c.a.r.r.m.a.t.t.y+new@googlemail.com',
      name: 'Matt Carr',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.id).toBe(existing.id);
    expect(result.value.email).toBe('carrmatty@gmail.com');
    expect(result.value.isApproved).toBe(true);
    expect(result.value.name).toBe('Matt Carr');
  });

  it('forbids non-admin actors', async () => {
    const member = await seedUser(db, {
      email: 'member@example.com',
      isApproved: true,
      isAdmin: false,
    });
    const repository = new DrizzleUserAccessRepository(db);

    const result = await preProvisionUserAccess(repository, {
      actorUserId: member.id,
      email: 'new.member@example.com',
      name: null,
    });

    expect(result).toEqual({ ok: false, error: 'Forbidden' });
  });
});
