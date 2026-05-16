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
import { searchOrganizationMemberCandidates } from './search-organization-member-candidates';

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

describe('searchOrganizationMemberCandidates', () => {
  it('returns alphabetical candidates for organization owners', async () => {
    const owner = await seedUser(db, {
      email: 'owner@example.com',
      name: 'Owner User',
      isApproved: true,
    });
    await seedUser(db, {
      email: 'bravo@example.com',
      name: 'Bravo',
      isApproved: true,
    });
    const alpha = await seedUser(db, {
      email: 'alpha@example.com',
      name: 'Alpha',
      isApproved: true,
    });
    const organization = await seedOrganization(db, owner.id, { name: 'Shared Planning' });
    const repository = new DrizzleOrganizationRepository(db);

    await repository.addMember({
      organizationId: organization.id,
      userId: alpha.id,
      role: 'member',
      createdAt: new Date(),
    });

    const result = await searchOrganizationMemberCandidates(repository, {
      actorUserId: owner.id,
      organizationId: organization.id,
      query: '',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.map((candidate) => candidate.email)).toEqual(['bravo@example.com']);
  });

  it('filters candidates by case-insensitive email and name contains', async () => {
    const owner = await seedUser(db, {
      email: 'owner@example.com',
      name: 'Owner User',
      isApproved: true,
    });
    await seedUser(db, {
      email: 'jane.doe@gmail.com',
      name: 'Jane Doe',
      isApproved: true,
    });
    await seedUser(db, {
      email: 'partner@example.com',
      name: 'Partner User',
      isApproved: true,
    });
    const organization = await seedOrganization(db, owner.id, { name: 'Shared Planning' });
    const repository = new DrizzleOrganizationRepository(db);

    const byEmail = await searchOrganizationMemberCandidates(repository, {
      actorUserId: owner.id,
      organizationId: organization.id,
      query: 'JANE.DOE',
    });
    expect(byEmail.ok).toBe(true);
    if (byEmail.ok) {
      expect(byEmail.value.map((candidate) => candidate.email)).toEqual(['jane.doe@gmail.com']);
    }

    const byName = await searchOrganizationMemberCandidates(repository, {
      actorUserId: owner.id,
      organizationId: organization.id,
      query: 'partner',
    });
    expect(byName.ok).toBe(true);
    if (byName.ok) {
      expect(byName.value.map((candidate) => candidate.email)).toEqual(['partner@example.com']);
    }
  });

  it('rejects search when actor is not an organization owner', async () => {
    const owner = await seedUser(db, {
      email: 'owner@example.com',
      name: 'Owner User',
      isApproved: true,
    });
    const member = await seedUser(db, {
      email: 'member@example.com',
      name: 'Member User',
      isApproved: true,
    });
    const organization = await seedOrganization(db, owner.id, { name: 'Shared Planning' });
    const repository = new DrizzleOrganizationRepository(db);

    await repository.addMember({
      organizationId: organization.id,
      userId: member.id,
      role: 'member',
      createdAt: new Date(),
    });

    const result = await searchOrganizationMemberCandidates(repository, {
      actorUserId: member.id,
      organizationId: organization.id,
      query: '',
    });

    expect(result).toEqual({ ok: false, error: 'Forbidden' });
  });
});
