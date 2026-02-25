import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { DrizzleDestinationRepository } from '@/infrastructure/db/repositories/drizzle-destination-repository';
import {
  type Db,
  type Sql,
  createTestDb,
  seedDestination,
  seedTrip,
  seedUser,
  truncateAll,
} from '@/infrastructure/testing/helpers';
import { removeDestination } from './remove-destination';

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

describe('removeDestination', () => {
  it('returns err when the destination does not exist', async () => {
    const destRepo = new DrizzleDestinationRepository(db);
    const result = await removeDestination(destRepo, crypto.randomUUID());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('not found');
  });

  it('deletes the destination and returns ok(true)', async () => {
    const { id: ownerId } = await seedUser(db);
    const trip = await seedTrip(db, ownerId);
    const dest = await seedDestination(db, trip.id);
    const destRepo = new DrizzleDestinationRepository(db);

    const result = await removeDestination(destRepo, dest.id);
    expect(result.ok).toBe(true);
  });

  it('destination is absent from the DB after removal', async () => {
    const { id: ownerId } = await seedUser(db);
    const trip = await seedTrip(db, ownerId);
    const dest = await seedDestination(db, trip.id);
    const destRepo = new DrizzleDestinationRepository(db);

    await removeDestination(destRepo, dest.id);
    expect(await destRepo.findById(dest.id)).toBeNull();
  });
});
