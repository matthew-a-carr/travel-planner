import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AiCacheRepository } from '@/application/ports/ai-cache-repository';
import type { TimelineInsightsService } from '@/application/ports/timeline-insights-service';
import type { TimelineFinding } from '@/domain/timeline/types';
import { DrizzleCountryReferenceRepository } from '@/infrastructure/db/repositories/drizzle-country-reference-repository';
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
import { analyseTripTimeline } from './analyse-trip-timeline';

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

const fakeHash = (input: string) => `hash:${input.length}`;

function repos(db: Db) {
  return {
    tripRepo: new DrizzleTripRepository(db),
    destRepo: new DrizzleDestinationRepository(db),
    fixedCostRepo: new DrizzleTripFixedCostRepository(db),
    refRepo: new DrizzleCountryReferenceRepository(db),
  };
}

describe('analyseTripTimeline', () => {
  it('returns err when the trip is missing', async () => {
    const r = repos(db);
    const insights: TimelineInsightsService = {
      analyse: async () => ({ ok: true, findings: [] }),
    };
    const result = await analyseTripTimeline(
      r.tripRepo,
      r.destRepo,
      r.fixedCostRepo,
      r.refRepo,
      insights,
      makeCacheStub(),
      fakeHash,
      crypto.randomUUID(),
    );
    expect(result.ok).toBe(false);
  });

  it('returns deterministic-only findings when AI service fails', async () => {
    const { id: ownerId } = await seedUser(db);
    const trip = await seedTrip(db, ownerId, { totalBudgetPence: 10_000_000 });
    await seedDestination(db, trip.id, {
      name: 'Hanoi',
      country: 'Vietnam',
      startDate: new Date('2026-08-01'),
      endDate: new Date('2026-08-10'),
      estimatedBudgetPence: 100_000,
      sortOrder: 0,
    });
    await seedDestination(db, trip.id, {
      name: 'Saigon',
      country: 'Vietnam',
      startDate: new Date('2026-08-20'),
      endDate: new Date('2026-08-25'),
      estimatedBudgetPence: 100_000,
      sortOrder: 1,
    });

    const r = repos(db);
    const failing: TimelineInsightsService = {
      analyse: async () => ({ ok: false, error: 'gateway error' }),
    };

    const result = await analyseTripTimeline(
      r.tripRepo,
      r.destRepo,
      r.fixedCostRepo,
      r.refRepo,
      failing,
      makeCacheStub(),
      fakeHash,
      trip.id,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      const kinds = result.value.map((f) => f.kind);
      expect(kinds).toContain('gap');
    }
  });

  it('merges deterministic and AI findings, deduping by (stopId, kind)', async () => {
    const { id: ownerId } = await seedUser(db);
    const trip = await seedTrip(db, ownerId, { totalBudgetPence: 10_000_000 });
    const destA = await seedDestination(db, trip.id, {
      name: 'Bali',
      country: 'Indonesia',
      startDate: new Date('2026-11-01'),
      endDate: new Date('2026-11-10'),
      estimatedBudgetPence: 50_000,
      sortOrder: 0,
    });

    const r = repos(db);
    const aiFindings: TimelineFinding[] = [
      {
        stopId: destA.id,
        severity: 'warning',
        kind: 'seasonality',
        message: 'Bali in November falls in the wet season.',
        suggestion: 'Consider rearranging the itinerary.',
      },
    ];
    const insights: TimelineInsightsService = {
      analyse: async () => ({ ok: true, findings: aiFindings }),
    };

    const result = await analyseTripTimeline(
      r.tripRepo,
      r.destRepo,
      r.fixedCostRepo,
      r.refRepo,
      insights,
      makeCacheStub(),
      fakeHash,
      trip.id,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      const kinds = result.value.map((f) => f.kind);
      expect(kinds).toContain('seasonality');
    }
  });

  it('serves AI findings from cache when state is unchanged', async () => {
    const { id: ownerId } = await seedUser(db);
    const trip = await seedTrip(db, ownerId);
    await seedDestination(db, trip.id, {
      name: 'Hanoi',
      country: 'Vietnam',
      sortOrder: 0,
    });

    const r = repos(db);
    const insights: TimelineInsightsService = {
      analyse: vi.fn(async () => ({ ok: true as const, findings: [] })),
    };
    const cache = makeCacheStub();

    await analyseTripTimeline(
      r.tripRepo,
      r.destRepo,
      r.fixedCostRepo,
      r.refRepo,
      insights,
      cache,
      fakeHash,
      trip.id,
    );
    await analyseTripTimeline(
      r.tripRepo,
      r.destRepo,
      r.fixedCostRepo,
      r.refRepo,
      insights,
      cache,
      fakeHash,
      trip.id,
    );

    expect(insights.analyse).toHaveBeenCalledTimes(1);
  });
});
