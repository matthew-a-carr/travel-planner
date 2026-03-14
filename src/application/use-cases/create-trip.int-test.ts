import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { DrizzleTripRepository } from '@/infrastructure/db/repositories/drizzle-trip-repository';
import {
  createTestDb,
  type Db,
  type Sql,
  seedOrganization,
  seedUser,
  truncateAll,
} from '@/infrastructure/testing/helpers';
import { createTrip } from './create-trip';

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

describe('createTrip', () => {
  it('creates a trip with status planning', async () => {
    const { id: ownerId } = await seedUser(db);
    const { id: organizationId } = await seedOrganization(db, ownerId);
    const repo = new DrizzleTripRepository(db);

    const result = await createTrip(repo, {
      organizationId,
      ownerId,
      name: 'Round the World',
      totalBudgetPence: 5_000_000,
      currency: 'GBP',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.status).toBe('planning');
  });

  it('persists the trip and returns it with a generated id', async () => {
    const { id: ownerId } = await seedUser(db);
    const { id: organizationId } = await seedOrganization(db, ownerId);
    const repo = new DrizzleTripRepository(db);

    const result = await createTrip(repo, {
      organizationId,
      ownerId,
      name: 'Asia Tour',
      totalBudgetPence: 3_000_000,
      currency: 'GBP',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.id).toBeTruthy();
    expect(result.value.name).toBe('Asia Tour');
    expect(result.value.totalBudget.amountPence).toBe(3_000_000);
    expect(result.value.totalBudget.currency).toBe('GBP');
    expect(result.value.organizationId).toBe(organizationId);
    expect(result.value.ownerId).toBe(ownerId);
  });

  it('is readable by findById after creation', async () => {
    const { id: ownerId } = await seedUser(db);
    const { id: organizationId } = await seedOrganization(db, ownerId);
    const repo = new DrizzleTripRepository(db);

    const result = await createTrip(repo, {
      organizationId,
      ownerId,
      name: 'Persisted Trip',
      totalBudgetPence: 1_000_000,
      currency: 'GBP',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const found = await repo.findById(result.value.id);
    expect(found?.name).toBe('Persisted Trip');
  });
});
