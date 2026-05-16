/**
 * Integration test for the chat write tools. Exercises the full path through
 * real Drizzle repositories + real Postgres (via Testcontainers): each tool
 * `execute` reaches the underlying use case and persists to the DB.
 *
 * The `streamText` call in the chat assistant adapter is not exercised here
 * (that needs a live AI Gateway); we test the tool-execution layer
 * deterministically. The adapter is covered separately by
 * `runtime-aware-services.test.ts` and the existing
 * `process-chat-message.int-test.ts`.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { DrizzleDestinationRepository } from '@/infrastructure/db/repositories/drizzle-destination-repository';
import { DrizzleSpendEntryRepository } from '@/infrastructure/db/repositories/drizzle-spend-entry-repository';
import { DrizzleTripFixedCostRepository } from '@/infrastructure/db/repositories/drizzle-trip-fixed-cost-repository';
import { DrizzleTripRepository } from '@/infrastructure/db/repositories/drizzle-trip-repository';
import {
  createTestDb,
  type Db,
  type Sql,
  seedDestination,
  seedTrip,
  seedUser,
  truncateAll,
} from '@/infrastructure/testing/helpers';
import { type ChatToolDeps, createChatTools } from './chat-tools';

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

function makeDeps(): ChatToolDeps {
  return {
    tripRepository: new DrizzleTripRepository(db),
    destinationRepository: new DrizzleDestinationRepository(db),
    spendEntryRepository: new DrizzleSpendEntryRepository(db),
    tripFixedCostRepository: new DrizzleTripFixedCostRepository(db),
  };
}

describe('chat write tools (integration)', () => {
  it('record_spend (auto path) persists a spend entry on the DB', async () => {
    const user = await seedUser(db);
    const trip = await seedTrip(db, user.id, { totalBudgetPence: 10_000_00 });
    const destination = await seedDestination(db, trip.id, {
      estimatedBudgetPence: 5_000_00,
      startDate: new Date('2026-04-01'),
      endDate: new Date('2026-04-15'),
    });

    const deps = makeDeps();
    const tools = createChatTools(deps, trip.id, () => new Date('2026-04-05'));

    const result = (await tools.record_spend.execute?.(
      {
        destinationId: destination.id,
        amountPence: 800,
        category: 'food',
        description: 'Pho',
      },
      { toolCallId: 'c1', messages: [] },
    )) as { ok?: boolean; spendEntryId?: string; summary?: string };

    expect(result.ok).toBe(true);
    expect(result.spendEntryId).toBeTypeOf('string');

    const persisted = await deps.spendEntryRepository.findByTrip(trip.id);
    expect(persisted).toHaveLength(1);
    expect(persisted[0]?.amount.amountPence).toBe(800);
    expect(persisted[0]?.category).toBe('food');
    expect(persisted[0]?.description).toBe('Pho');
  });

  it('record_spend (confirm path) refuses without confirmation, then proceeds with confirmed: true', async () => {
    const user = await seedUser(db);
    const trip = await seedTrip(db, user.id, { totalBudgetPence: 10_000_00 });
    const destination = await seedDestination(db, trip.id, {
      estimatedBudgetPence: 1_000,
      startDate: new Date('2026-04-01'),
      endDate: new Date('2026-04-15'),
    });

    const deps = makeDeps();
    const tools = createChatTools(deps, trip.id, () => new Date('2026-04-05'));

    const first = (await tools.record_spend.execute?.(
      {
        destinationId: destination.id,
        amountPence: 5_000,
        category: 'food',
      },
      { toolCallId: 'c1', messages: [] },
    )) as { requiresConfirmation?: boolean };

    expect(first.requiresConfirmation).toBe(true);
    expect(await deps.spendEntryRepository.findByTrip(trip.id)).toHaveLength(0);

    const second = (await tools.record_spend.execute?.(
      {
        destinationId: destination.id,
        amountPence: 5_000,
        category: 'food',
        confirmed: true,
      },
      { toolCallId: 'c2', messages: [] },
    )) as { ok?: boolean };

    expect(second.ok).toBe(true);
    const persisted = await deps.spendEntryRepository.findByTrip(trip.id);
    expect(persisted).toHaveLength(1);
    expect(persisted[0]?.amount.amountPence).toBe(5_000);
  });

  it('refuses to record_spend on a destination from a different trip', async () => {
    const user = await seedUser(db);
    const tripA = await seedTrip(db, user.id, { name: 'A' });
    const tripB = await seedTrip(db, user.id, { name: 'B' });
    const destB = await seedDestination(db, tripB.id);

    const deps = makeDeps();
    const tools = createChatTools(deps, tripA.id);

    const result = (await tools.record_spend.execute?.(
      { destinationId: destB.id, amountPence: 100, category: 'food' },
      { toolCallId: 'c1', messages: [] },
    )) as { error?: string };

    expect(result.error).toMatch(/not part of this trip/);
    expect(await deps.spendEntryRepository.findByTrip(tripA.id)).toHaveLength(0);
    expect(await deps.spendEntryRepository.findByTrip(tripB.id)).toHaveLength(0);
  });

  it('delete_spend_entry removes the row and returns undo metadata', async () => {
    const user = await seedUser(db);
    const trip = await seedTrip(db, user.id);
    const destination = await seedDestination(db, trip.id);

    const deps = makeDeps();
    const tools = createChatTools(deps, trip.id, () => new Date('2026-04-05'));

    const recorded = (await tools.record_spend.execute?.(
      {
        destinationId: destination.id,
        amountPence: 300,
        category: 'food',
        confirmed: true,
      },
      { toolCallId: 'c1', messages: [] },
    )) as { ok?: boolean; spendEntryId: string };

    expect(recorded.ok).toBe(true);

    const deleted = (await tools.delete_spend_entry.execute?.(
      { spendEntryId: recorded.spendEntryId },
      { toolCallId: 'c2', messages: [] },
    )) as {
      ok?: boolean;
      undo?: { kind: string; destinationId: string; amountPence: number };
    };

    expect(deleted.ok).toBe(true);
    expect(deleted.undo?.kind).toBe('record_spend');
    expect(deleted.undo?.destinationId).toBe(destination.id);
    expect(deleted.undo?.amountPence).toBe(300);
    expect(await deps.spendEntryRepository.findByTrip(trip.id)).toHaveLength(0);
  });

  it('edit_trip_budget always requires confirmation, then applies on confirmed: true', async () => {
    const user = await seedUser(db);
    const trip = await seedTrip(db, user.id, { totalBudgetPence: 5_000_00 });

    const deps = makeDeps();
    const tools = createChatTools(deps, trip.id);

    const first = (await tools.edit_trip_budget.execute?.(
      { totalBudgetPence: 6_000_00 },
      { toolCallId: 'c1', messages: [] },
    )) as { requiresConfirmation?: boolean };
    expect(first.requiresConfirmation).toBe(true);
    const stillOriginal = await deps.tripRepository.findById(trip.id);
    expect(stillOriginal?.totalBudget.amountPence).toBe(5_000_00);

    const second = (await tools.edit_trip_budget.execute?.(
      { totalBudgetPence: 6_000_00, confirmed: true },
      { toolCallId: 'c2', messages: [] },
    )) as { ok?: boolean };
    expect(second.ok).toBe(true);

    const updated = await deps.tripRepository.findById(trip.id);
    expect(updated?.totalBudget.amountPence).toBe(6_000_00);
  });

  it('add_fixed_cost auto-executes when within headroom and persists', async () => {
    const user = await seedUser(db);
    const trip = await seedTrip(db, user.id, { totalBudgetPence: 10_000_00 });

    const deps = makeDeps();
    const tools = createChatTools(deps, trip.id);

    const result = (await tools.add_fixed_cost.execute?.(
      {
        label: 'Insurance',
        amountPence: 500_00,
        category: 'insurance',
        date: '2026-03-15',
      },
      { toolCallId: 'c1', messages: [] },
    )) as { ok?: boolean; fixedCostId?: string };

    expect(result.ok).toBe(true);
    expect(result.fixedCostId).toBeTypeOf('string');

    const persisted = await deps.tripFixedCostRepository.findByTrip(trip.id);
    expect(persisted).toHaveLength(1);
    expect(persisted[0]?.label).toBe('Insurance');
    expect(persisted[0]?.amount.amountPence).toBe(500_00);
  });
});
