import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AiCacheRepository } from '@/application/ports/ai-cache-repository';
import type { TripNarrativeService } from '@/application/ports/trip-narrative-service';
import { DrizzleDestinationRepository } from '@/infrastructure/db/repositories/drizzle-destination-repository';
import { DrizzleSpendEntryRepository } from '@/infrastructure/db/repositories/drizzle-spend-entry-repository';
import { DrizzleTripFixedCostRepository } from '@/infrastructure/db/repositories/drizzle-trip-fixed-cost-repository';
import { DrizzleTripRepository } from '@/infrastructure/db/repositories/drizzle-trip-repository';
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
import { summariseTripNarrative } from './summarise-trip-narrative';

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

// Use the full input as the key so cache rolls reflect content changes,
// not just length differences. Matching length but different content is
// exactly what slips through `hash:${length}` style stubs.
const fakeHash = (input: string) => `hash:${input}`;

function repos(db: Db) {
  return {
    tripRepo: new DrizzleTripRepository(db),
    destRepo: new DrizzleDestinationRepository(db),
    fixedCostRepo: new DrizzleTripFixedCostRepository(db),
    spendRepo: new DrizzleSpendEntryRepository(db),
  };
}

describe('summariseTripNarrative', () => {
  it('returns err when the trip does not exist', async () => {
    const r = repos(db);
    const narrative: TripNarrativeService = {
      summarise: async () => ({ ok: true, result: { narrative: 'x', bullets: [] } }),
    };
    const result = await summariseTripNarrative(
      r.tripRepo,
      r.destRepo,
      r.fixedCostRepo,
      r.spendRepo,
      narrative,
      makeCacheStub(),
      fakeHash,
      crypto.randomUUID(),
      new Date('2026-08-01'),
    );
    expect(result.ok).toBe(false);
  });

  it('returns the service result on first call and caches it', async () => {
    const { id: ownerId } = await seedUser(db);
    const trip = await seedTrip(db, ownerId);
    await seedDestination(db, trip.id, {
      country: 'Vietnam',
      startDate: new Date('2026-07-25'),
      endDate: new Date('2026-08-05'),
    });

    const r = repos(db);
    const narrative: TripNarrativeService = {
      summarise: vi.fn(async () => ({
        ok: true as const,
        result: { narrative: 'On track for now.', bullets: ['Keep going.'] },
      })),
    };
    const cache = makeCacheStub();

    const first = await summariseTripNarrative(
      r.tripRepo,
      r.destRepo,
      r.fixedCostRepo,
      r.spendRepo,
      narrative,
      cache,
      fakeHash,
      trip.id,
      new Date('2026-08-01'),
    );

    expect(first.ok).toBe(true);
    if (first.ok) {
      expect(first.value.narrative).toBe('On track for now.');
      expect(first.value.bullets).toEqual(['Keep going.']);
    }

    const second = await summariseTripNarrative(
      r.tripRepo,
      r.destRepo,
      r.fixedCostRepo,
      r.spendRepo,
      narrative,
      cache,
      fakeHash,
      trip.id,
      new Date('2026-08-01'),
    );

    expect(second.ok).toBe(true);
    expect(narrative.summarise).toHaveBeenCalledTimes(1);
  });

  it('degrades silently to an empty narrative when the AI service fails', async () => {
    const { id: ownerId } = await seedUser(db);
    const trip = await seedTrip(db, ownerId);
    await seedDestination(db, trip.id, { country: 'Vietnam' });

    const r = repos(db);
    const narrative: TripNarrativeService = {
      summarise: async () => ({ ok: false, error: 'gateway 503' }),
    };

    const result = await summariseTripNarrative(
      r.tripRepo,
      r.destRepo,
      r.fixedCostRepo,
      r.spendRepo,
      narrative,
      makeCacheStub(),
      fakeHash,
      trip.id,
      new Date('2026-08-01'),
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.narrative).toBe('');
      expect(result.value.bullets).toEqual([]);
    }
  });

  it('rolls the cache when the current day changes', async () => {
    const { id: ownerId } = await seedUser(db);
    const trip = await seedTrip(db, ownerId);
    await seedDestination(db, trip.id, { country: 'Vietnam' });

    const r = repos(db);
    const narrative: TripNarrativeService = {
      summarise: vi.fn(async () => ({
        ok: true as const,
        result: { narrative: 'day-specific narrative', bullets: [] },
      })),
    };
    const cache = makeCacheStub();

    await summariseTripNarrative(
      r.tripRepo,
      r.destRepo,
      r.fixedCostRepo,
      r.spendRepo,
      narrative,
      cache,
      fakeHash,
      trip.id,
      new Date('2026-08-01'),
    );
    await summariseTripNarrative(
      r.tripRepo,
      r.destRepo,
      r.fixedCostRepo,
      r.spendRepo,
      narrative,
      cache,
      fakeHash,
      trip.id,
      new Date('2026-08-02'),
    );

    expect(narrative.summarise).toHaveBeenCalledTimes(2);
  });

  it('rolls the cache when spend total changes within the same day', async () => {
    const { id: ownerId } = await seedUser(db);
    const trip = await seedTrip(db, ownerId);
    const dest = await seedDestination(db, trip.id, {
      country: 'Vietnam',
      startDate: new Date('2026-07-25'),
      endDate: new Date('2026-08-05'),
    });
    await seedSpendEntry(db, dest.id, { amountPence: 1_000, spentAt: new Date('2026-07-30') });

    const r = repos(db);
    const narrative: TripNarrativeService = {
      summarise: vi.fn(async () => ({
        ok: true as const,
        result: { narrative: 'a', bullets: [] },
      })),
    };
    const cache = makeCacheStub();

    await summariseTripNarrative(
      r.tripRepo,
      r.destRepo,
      r.fixedCostRepo,
      r.spendRepo,
      narrative,
      cache,
      fakeHash,
      trip.id,
      new Date('2026-08-01'),
    );

    await seedSpendEntry(db, dest.id, { amountPence: 2_500, spentAt: new Date('2026-07-31') });

    await summariseTripNarrative(
      r.tripRepo,
      r.destRepo,
      r.fixedCostRepo,
      r.spendRepo,
      narrative,
      cache,
      fakeHash,
      trip.id,
      new Date('2026-08-01'),
    );

    expect(narrative.summarise).toHaveBeenCalledTimes(2);
  });
});
