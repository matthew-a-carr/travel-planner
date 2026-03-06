import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { DrizzleOrganizationRepository } from '@/infrastructure/db/repositories/drizzle-organization-repository';
import {
  createTestDb,
  type Db,
  type Sql,
  seedUser,
  truncateAll,
} from '@/infrastructure/testing/helpers';
import { ensureUserOrganization } from './ensure-user-organization';

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

describe('ensureUserOrganization', () => {
  it('creates a personal organization for first sign-in users', async () => {
    const { id: userId, email } = await seedUser(db, { name: 'Matt Carr' });
    const repo = new DrizzleOrganizationRepository(db);

    const result = await ensureUserOrganization(repo, {
      userId,
      userName: 'Matt Carr',
      email,
    });

    expect(result.role).toBe('owner');
    expect(result.organization.name).toBe("Matt Carr's Workspace");

    const memberships = await repo.findOrganizationsForUser(userId);
    expect(memberships).toHaveLength(1);
  });

  it('is idempotent when user already has organizations', async () => {
    const { id: userId, email } = await seedUser(db, { name: 'Matt Carr' });
    const repo = new DrizzleOrganizationRepository(db);

    const first = await ensureUserOrganization(repo, {
      userId,
      userName: 'Matt Carr',
      email,
    });
    const second = await ensureUserOrganization(repo, {
      userId,
      userName: 'Matt Carr',
      email,
    });

    expect(second.organization.id).toBe(first.organization.id);
    const memberships = await repo.findOrganizationsForUser(userId);
    expect(memberships).toHaveLength(1);
  });
});
