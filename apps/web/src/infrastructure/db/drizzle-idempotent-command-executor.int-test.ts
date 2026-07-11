import { count } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTrip } from '@/application/use-cases/create-trip';
import { DrizzleCountryReferenceRepository } from '@/infrastructure/db/repositories/drizzle-country-reference-repository';
import { DrizzleDestinationRepository } from '@/infrastructure/db/repositories/drizzle-destination-repository';
import { DrizzleOrganizationRepository } from '@/infrastructure/db/repositories/drizzle-organization-repository';
import { DrizzleTripFixedCostRepository } from '@/infrastructure/db/repositories/drizzle-trip-fixed-cost-repository';
import { DrizzleTripRepository } from '@/infrastructure/db/repositories/drizzle-trip-repository';
import {
  createTestDb,
  type Db,
  type Sql,
  seedOrganization,
  seedUser,
  truncateAll,
} from '@/infrastructure/testing/helpers';
import { DrizzleIdempotentCommandExecutor } from './drizzle-idempotent-command-executor';
import { idempotentCommands, trips } from './schema';

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

function createExecutor() {
  return new DrizzleIdempotentCommandExecutor(db, (tx) => ({
    tripRepository: new DrizzleTripRepository(tx),
    destinationRepository: new DrizzleDestinationRepository(tx),
    tripFixedCostRepository: new DrizzleTripFixedCostRepository(tx),
    organizationRepository: new DrizzleOrganizationRepository(tx),
    countryReferenceRepository: new DrizzleCountryReferenceRepository(tx),
  }));
}

describe('DrizzleIdempotentCommandExecutor', () => {
  it('executes once and replays the exact stored response', async () => {
    const { id: userId } = await seedUser(db);
    const command = vi.fn(async () => ({ status: 201, body: { data: { id: 'trip-1' } } }));
    const executor = createExecutor();
    const input = {
      userId,
      operation: 'trip.create',
      idempotencyKey: 'key-1',
      requestHash: 'hash-1',
    };

    const first = await executor.execute(input, command);
    const replay = await executor.execute(input, command);

    expect(first).toEqual({
      kind: 'executed',
      response: { status: 201, body: { data: { id: 'trip-1' } } },
    });
    expect(replay).toEqual({
      kind: 'replayed',
      response: { status: 201, body: { data: { id: 'trip-1' } } },
    });
    expect(command).toHaveBeenCalledTimes(1);
  });

  it('rejects reuse of a key with a different request hash', async () => {
    const { id: userId } = await seedUser(db);
    const command = vi.fn(async () => ({ status: 204, body: null }));
    const executor = createExecutor();

    await executor.execute(
      { userId, operation: 'trip.delete', idempotencyKey: 'key-2', requestHash: 'hash-a' },
      command,
    );
    const conflict = await executor.execute(
      { userId, operation: 'trip.delete', idempotencyKey: 'key-2', requestHash: 'hash-b' },
      command,
    );

    expect(conflict).toEqual({ kind: 'conflict' });
    expect(command).toHaveBeenCalledTimes(1);
  });

  it('rolls back both the mutation and claim when the command fails', async () => {
    const { id: userId } = await seedUser(db);
    const { id: organizationId } = await seedOrganization(db, userId);
    const executor = createExecutor();
    const input = {
      userId,
      operation: 'trip.create',
      idempotencyKey: 'key-3',
      requestHash: 'hash-3',
    };

    await expect(
      executor.execute(input, async ({ tripRepository }) => {
        await createTrip(tripRepository, {
          organizationId,
          ownerId: userId,
          name: 'Rolled back',
          totalBudgetPence: 100_000,
          currency: 'GBP',
        });
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');

    const [tripCount] = await db.select({ value: count() }).from(trips);
    const [claimCount] = await db.select({ value: count() }).from(idempotentCommands);
    expect(tripCount?.value).toBe(0);
    expect(claimCount?.value).toBe(0);
  });

  it('serializes concurrent requests for the same key', async () => {
    const { id: userId } = await seedUser(db);
    const executor = createExecutor();
    const command = vi.fn(async () => ({ status: 200, body: { data: 'once' } }));
    const input = {
      userId,
      operation: 'trip.update',
      idempotencyKey: 'key-4',
      requestHash: 'hash-4',
    };

    const results = await Promise.all([
      executor.execute(input, command),
      executor.execute(input, command),
    ]);

    expect(results.map((result) => result.kind).sort()).toEqual(['executed', 'replayed']);
    expect(command).toHaveBeenCalledTimes(1);
  });
});
