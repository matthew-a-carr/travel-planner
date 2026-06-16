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
import { updateTravellerProfile } from './update-traveller-profile';

let db: Db;
let sql: Sql;
const TODAY = '2026-06-16';

beforeAll(() => {
  ({ db, sql } = createTestDb());
});

afterAll(async () => {
  await sql.end();
});

beforeEach(async () => {
  await truncateAll(db);
});

describe('updateTravellerProfile', () => {
  it('persists a validated profile', async () => {
    const { id } = await seedUser(db);
    const repo = new DrizzleUserProfileRepository(db);
    const result = await updateTravellerProfile(repo, {
      userId: id,
      dateOfBirth: '1990-05-15',
      passports: [{ nationality: 'gbr', label: '  UK passport ' }],
      today: TODAY,
    });
    expect(result.ok).toBe(true);
    expect(await getTravellerProfile(repo, id)).toEqual({
      dateOfBirth: '1990-05-15',
      passports: [{ nationality: 'GBR', label: 'UK passport' }],
    });
  });

  it('deduplicates the same nationality', async () => {
    const { id } = await seedUser(db);
    const repo = new DrizzleUserProfileRepository(db);
    await updateTravellerProfile(repo, {
      userId: id,
      dateOfBirth: null,
      passports: [
        { nationality: 'GBR', label: null },
        { nationality: 'GBR', label: 'dup' },
      ],
      today: TODAY,
    });
    expect((await getTravellerProfile(repo, id)).passports).toEqual([
      { nationality: 'GBR', label: null },
    ]);
  });

  it('rejects a future date of birth and persists nothing', async () => {
    const { id } = await seedUser(db);
    const repo = new DrizzleUserProfileRepository(db);
    const result = await updateTravellerProfile(repo, {
      userId: id,
      dateOfBirth: '2030-01-01',
      passports: [{ nationality: 'GBR', label: null }],
      today: TODAY,
    });
    expect(result.ok).toBe(false);
    expect(await getTravellerProfile(repo, id)).toEqual({ dateOfBirth: null, passports: [] });
  });

  it('removes passports when saved with fewer', async () => {
    const { id } = await seedUser(db);
    const repo = new DrizzleUserProfileRepository(db);
    await updateTravellerProfile(repo, {
      userId: id,
      dateOfBirth: null,
      passports: [
        { nationality: 'GBR', label: null },
        { nationality: 'IRL', label: null },
      ],
      today: TODAY,
    });
    await updateTravellerProfile(repo, {
      userId: id,
      dateOfBirth: null,
      passports: [{ nationality: 'IRL', label: null }],
      today: TODAY,
    });
    expect((await getTravellerProfile(repo, id)).passports).toEqual([
      { nationality: 'IRL', label: null },
    ]);
  });
});
