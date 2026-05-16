import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AiCacheRepository } from '@/application/ports/ai-cache-repository';
import type { PreDeparturePlannerService } from '@/application/ports/pre-departure-planner-service';
import { DrizzleDestinationRepository } from '@/infrastructure/db/repositories/drizzle-destination-repository';
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
import { generatePreDeparturePlan } from './generate-pre-departure-plan';

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

function makeCacheStub(): AiCacheRepository {
  const store = new Map<string, unknown>();
  return {
    get: vi.fn(async (hash: string) => (store.get(hash) ?? null) as unknown as never),
    set: vi.fn(async (hash: string, payload: unknown) => {
      store.set(hash, payload);
    }),
  };
}

// Use full input as the key so cache rolls reflect content changes, not
// just length.
const fakeHash = (input: string) => `hash:${input}`;

function repos(db: Db) {
  return {
    tripRepo: new DrizzleTripRepository(db),
    destRepo: new DrizzleDestinationRepository(db),
    fixedCostRepo: new DrizzleTripFixedCostRepository(db),
  };
}

describe('generatePreDeparturePlan', () => {
  it('returns err when the trip does not exist', async () => {
    const r = repos(db);
    const planner: PreDeparturePlannerService = {
      plan: async () => ({ ok: true, result: { items: [], transportLegs: [] } }),
    };
    const result = await generatePreDeparturePlan(
      r.tripRepo,
      r.destRepo,
      r.fixedCostRepo,
      planner,
      makeCacheStub(),
      fakeHash,
      crypto.randomUUID(),
      new Date('2026-05-15'),
    );
    expect(result.ok).toBe(false);
  });

  it('returns the planner result on first call and caches the dehydrated payload', async () => {
    const { id: ownerId } = await seedUser(db);
    const trip = await seedTrip(db, ownerId);
    await seedDestination(db, trip.id, {
      country: 'Australia',
      startDate: new Date('2026-09-15'),
      endDate: new Date('2027-09-15'),
    });

    const r = repos(db);
    const planner: PreDeparturePlannerService = {
      plan: vi.fn(async () => ({
        ok: true as const,
        result: {
          items: [
            {
              title: 'Apply for Australia WHV',
              category: 'visa' as const,
              dueDate: new Date('2026-09-01'),
              costPence: 45_500,
              suggestion: 'Apply online and verify with the embassy.',
              verifyAt: 'embassy' as const,
            },
          ],
          transportLegs: [],
        },
      })),
    };
    const cache = makeCacheStub();

    const first = await generatePreDeparturePlan(
      r.tripRepo,
      r.destRepo,
      r.fixedCostRepo,
      planner,
      cache,
      fakeHash,
      trip.id,
      new Date('2026-05-15'),
    );
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.value.items).toHaveLength(1);
    expect(first.value.items[0].dueDate?.toISOString().slice(0, 10)).toBe('2026-09-01');

    const second = await generatePreDeparturePlan(
      r.tripRepo,
      r.destRepo,
      r.fixedCostRepo,
      planner,
      cache,
      fakeHash,
      trip.id,
      new Date('2026-05-15'),
    );

    expect(second.ok).toBe(true);
    if (!second.ok) return;
    // Cache hit — same payload, rehydrated.
    expect(second.value.items[0].title).toBe('Apply for Australia WHV');
    expect(second.value.items[0].dueDate?.toISOString().slice(0, 10)).toBe('2026-09-01');
    expect(planner.plan).toHaveBeenCalledTimes(1);
  });

  it('degrades silently to an empty plan on AI failure (best-effort)', async () => {
    const { id: ownerId } = await seedUser(db);
    const trip = await seedTrip(db, ownerId);
    await seedDestination(db, trip.id, { country: 'Vietnam' });

    const r = repos(db);
    const planner: PreDeparturePlannerService = {
      plan: async () => ({ ok: false, error: 'gateway 503' }),
    };

    const result = await generatePreDeparturePlan(
      r.tripRepo,
      r.destRepo,
      r.fixedCostRepo,
      planner,
      makeCacheStub(),
      fakeHash,
      trip.id,
      new Date('2026-05-15'),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.items).toEqual([]);
    expect(result.value.transportLegs).toEqual([]);
  });

  it('rolls the cache when the current day changes', async () => {
    const { id: ownerId } = await seedUser(db);
    const trip = await seedTrip(db, ownerId);
    await seedDestination(db, trip.id, { country: 'Vietnam' });

    const r = repos(db);
    const planner: PreDeparturePlannerService = {
      plan: vi.fn(async () => ({
        ok: true as const,
        result: { items: [], transportLegs: [] },
      })),
    };
    const cache = makeCacheStub();

    await generatePreDeparturePlan(
      r.tripRepo,
      r.destRepo,
      r.fixedCostRepo,
      planner,
      cache,
      fakeHash,
      trip.id,
      new Date('2026-05-15'),
    );
    await generatePreDeparturePlan(
      r.tripRepo,
      r.destRepo,
      r.fixedCostRepo,
      planner,
      cache,
      fakeHash,
      trip.id,
      new Date('2026-05-16'),
    );

    expect(planner.plan).toHaveBeenCalledTimes(2);
  });
});
