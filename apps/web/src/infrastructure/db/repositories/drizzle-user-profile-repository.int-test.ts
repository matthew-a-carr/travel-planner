import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { TravellerProfile } from '@/domain/visa/types';
import { createTestDb, type Db, type Sql, seedUser, truncateAll } from '../../testing/helpers';
import { DrizzleUserProfileRepository } from './drizzle-user-profile-repository';

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

describe('DrizzleUserProfileRepository', () => {
  it('returns an empty profile for a user with nothing saved', async () => {
    const { id } = await seedUser(db);
    const repo = new DrizzleUserProfileRepository(db);
    expect(await repo.findByUserId(id)).toEqual({ dateOfBirth: null, passports: [] });
  });

  it('round-trips date of birth and ordered passports', async () => {
    const { id } = await seedUser(db);
    const repo = new DrizzleUserProfileRepository(db);
    const profile: TravellerProfile = {
      dateOfBirth: '1990-05-15',
      passports: [
        { nationality: 'GBR', label: 'UK passport' },
        { nationality: 'IRL', label: null },
      ],
    };
    await repo.save(id, profile);
    expect(await repo.findByUserId(id)).toEqual(profile);
  });

  it('replaces passports on save (removal persists)', async () => {
    const { id } = await seedUser(db);
    const repo = new DrizzleUserProfileRepository(db);
    await repo.save(id, {
      dateOfBirth: '1990-05-15',
      passports: [
        { nationality: 'GBR', label: null },
        { nationality: 'IRL', label: null },
      ],
    });
    await repo.save(id, {
      dateOfBirth: '1990-05-15',
      passports: [{ nationality: 'GBR', label: null }],
    });

    const after = await repo.findByUserId(id);
    expect(after.passports).toEqual([{ nationality: 'GBR', label: null }]);
  });

  it('can clear the date of birth', async () => {
    const { id } = await seedUser(db);
    const repo = new DrizzleUserProfileRepository(db);
    await repo.save(id, { dateOfBirth: '1990-05-15', passports: [] });
    await repo.save(id, { dateOfBirth: null, passports: [] });
    expect((await repo.findByUserId(id)).dateOfBirth).toBeNull();
  });
});
