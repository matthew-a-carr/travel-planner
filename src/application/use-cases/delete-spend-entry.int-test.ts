import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { DrizzleSpendEntryRepository } from '@/infrastructure/db/repositories/drizzle-spend-entry-repository';
import {
  createTestDb,
  type Db,
  type Sql,
  seedDestination,
  seedSpendEntry,
  seedTrip,
  seedUser,
  truncateAll,
} from '@/infrastructure/testing/helpers';
import { deleteSpendEntry } from './delete-spend-entry';

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

describe('deleteSpendEntry', () => {
  it('deletes the entry from the database', async () => {
    const { id: ownerId } = await seedUser(db);
    const trip = await seedTrip(db, ownerId);
    const dest = await seedDestination(db, trip.id);
    const entry = await seedSpendEntry(db, dest.id);
    const spendRepo = new DrizzleSpendEntryRepository(db);

    await deleteSpendEntry(spendRepo, entry.id);

    expect(await spendRepo.findById(entry.id)).toBeNull();
  });

  it('is a no-op for a non-existent id', async () => {
    const spendRepo = new DrizzleSpendEntryRepository(db);
    await expect(deleteSpendEntry(spendRepo, crypto.randomUUID())).resolves.toBeUndefined();
  });
});
