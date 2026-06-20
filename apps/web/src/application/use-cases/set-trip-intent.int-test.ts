import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { DrizzleTripRepository } from '../../infrastructure/db/repositories/drizzle-trip-repository';
import {
  createTestDb,
  type Db,
  type Sql,
  seedTrip,
  seedUser,
  truncateAll,
} from '../../infrastructure/testing/helpers';
import { setTripIntent } from './set-trip-intent';

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

describe('setTripIntent', () => {
  it('defaults to tourism and persists a new intent', async () => {
    const { id: ownerId } = await seedUser(db);
    const trip = await seedTrip(db, ownerId);
    const repo = new DrizzleTripRepository(db);

    expect(await repo.getIntent(trip.id)).toBe('tourism');

    const result = await setTripIntent(repo, { tripId: trip.id, intent: 'working-holiday' });
    expect(result).toEqual({ ok: true, value: 'working-holiday' });
    expect(await repo.getIntent(trip.id)).toBe('working-holiday');
  });

  it('rejects an unknown intent without persisting', async () => {
    const { id: ownerId } = await seedUser(db);
    const trip = await seedTrip(db, ownerId);
    const repo = new DrizzleTripRepository(db);

    const result = await setTripIntent(repo, { tripId: trip.id, intent: 'vacation' });
    expect(result.ok).toBe(false);
    expect(await repo.getIntent(trip.id)).toBe('tourism');
  });

  it('rejects a missing trip', async () => {
    const repo = new DrizzleTripRepository(db);
    const result = await setTripIntent(repo, { tripId: crypto.randomUUID(), intent: 'tourism' });
    expect(result.ok).toBe(false);
  });
});
