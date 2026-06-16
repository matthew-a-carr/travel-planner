import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { DrizzleUserProfileRepository } from '../../infrastructure/db/repositories/drizzle-user-profile-repository';
import {
  createTestDb,
  type Db,
  type Sql,
  seedUser,
  truncateAll,
} from '../../infrastructure/testing/helpers';
import { getTravellerProfile } from './get-traveller-profile';

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

describe('getTravellerProfile', () => {
  it('returns an empty profile when none is saved', async () => {
    const { id } = await seedUser(db);
    const repo = new DrizzleUserProfileRepository(db);
    expect(await getTravellerProfile(repo, id)).toEqual({ dateOfBirth: null, passports: [] });
  });

  it('returns the saved profile', async () => {
    const { id } = await seedUser(db);
    const repo = new DrizzleUserProfileRepository(db);
    await repo.save(id, {
      dateOfBirth: '1988-01-02',
      passports: [{ nationality: 'GBR', label: null }],
    });
    expect(await getTravellerProfile(repo, id)).toEqual({
      dateOfBirth: '1988-01-02',
      passports: [{ nationality: 'GBR', label: null }],
    });
  });
});
