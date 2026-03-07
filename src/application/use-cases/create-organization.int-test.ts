import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { DrizzleOrganizationRepository } from '@/infrastructure/db/repositories/drizzle-organization-repository';
import { DrizzleUserAccessRepository } from '@/infrastructure/db/repositories/drizzle-user-access-repository';
import {
  createTestDb,
  type Db,
  type Sql,
  seedUser,
  truncateAll,
} from '@/infrastructure/testing/helpers';
import { createOrganization } from './create-organization';

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

describe('createOrganization', () => {
  it('creates an organization and owner membership', async () => {
    const { id: actorUserId } = await seedUser(db, {
      email: 'owner@example.com',
      isAdmin: true,
      isApproved: true,
    });
    const organizationRepository = new DrizzleOrganizationRepository(db);
    const userAccessRepository = new DrizzleUserAccessRepository(db);

    const result = await createOrganization(organizationRepository, userAccessRepository, {
      actorUserId,
      name: 'Shared Planning',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.name).toBe('Shared Planning');
    const membership = await organizationRepository.findMembership(result.value.id, actorUserId);
    expect(membership?.role).toBe('owner');
  });

  it('returns an error for blank names', async () => {
    const { id: actorUserId } = await seedUser(db, {
      email: 'owner@example.com',
      isAdmin: true,
      isApproved: true,
    });
    const organizationRepository = new DrizzleOrganizationRepository(db);
    const userAccessRepository = new DrizzleUserAccessRepository(db);

    const result = await createOrganization(organizationRepository, userAccessRepository, {
      actorUserId,
      name: '   ',
    });

    expect(result.ok).toBe(false);
  });

  it('forbids non-admin actors', async () => {
    const { id: actorUserId } = await seedUser(db, {
      email: 'member@example.com',
      isAdmin: false,
      isApproved: true,
    });
    const organizationRepository = new DrizzleOrganizationRepository(db);
    const userAccessRepository = new DrizzleUserAccessRepository(db);

    const result = await createOrganization(organizationRepository, userAccessRepository, {
      actorUserId,
      name: 'Member Attempt',
    });

    expect(result).toEqual({ ok: false, error: 'Forbidden' });
  });
});
