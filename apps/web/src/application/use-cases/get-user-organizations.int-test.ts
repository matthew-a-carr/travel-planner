import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { DrizzleOrganizationRepository } from '@/infrastructure/db/repositories/drizzle-organization-repository';
import {
  createTestDb,
  type Db,
  type Sql,
  seedOrganization,
  seedUser,
  truncateAll,
} from '@/infrastructure/testing/helpers';
import { getUserOrganizations } from './get-user-organizations';

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

describe('getUserOrganizations', () => {
  it('returns organizations where the user is a member', async () => {
    const { id: ownerUserId } = await seedUser(db, { email: 'owner@example.com' });
    await seedOrganization(db, ownerUserId, { name: 'Org One' });
    await seedOrganization(db, ownerUserId, { name: 'Org Two' });

    const organizations = await getUserOrganizations(
      new DrizzleOrganizationRepository(db),
      ownerUserId,
    );
    expect(organizations).toHaveLength(2);
    expect(organizations.every((organization) => organization.role === 'owner')).toBe(true);
  });
});
