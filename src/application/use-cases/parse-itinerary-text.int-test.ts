import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AiCacheRepository } from '@/application/ports/ai-cache-repository';
import type { ItineraryParser, ParseItineraryOutcome } from '@/application/ports/itinerary-parser';
import type { ParsedItineraryRow } from '@/domain/timeline/types';
import { DrizzleCountryReferenceRepository } from '@/infrastructure/db/repositories/drizzle-country-reference-repository';
import { DrizzleTripRepository } from '@/infrastructure/db/repositories/drizzle-trip-repository';
import {
  createTestDb,
  type Db,
  type Sql,
  seedCountryReference,
  seedTrip,
  seedUser,
  truncateAll,
} from '@/infrastructure/testing/helpers';
import { parseItineraryText } from './parse-itinerary-text';

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

function makeRow(overrides: Partial<ParsedItineraryRow> = {}): ParsedItineraryRow {
  return {
    country: 'Vietnam',
    city: 'Hanoi',
    startDate: new Date('2026-08-01'),
    endDate: new Date('2026-08-15'),
    comfortLevel: 'mid',
    suggestedBudgetPence: null,
    confidence: 'high',
    notes: null,
    ...overrides,
  };
}

function makeParserStub(rows: ParsedItineraryRow[], unresolved: string[] = []): ItineraryParser {
  return {
    parse: vi.fn(
      async (): Promise<ParseItineraryOutcome> => ({
        ok: true,
        result: { rows, unresolved },
      }),
    ),
  };
}

function makeCacheStub(): AiCacheRepository {
  const store = new Map<string, unknown>();
  return {
    get: vi.fn(async (hash: string) => (store.get(hash) ?? null) as unknown as never),
    set: vi.fn(async (hash: string, payload: unknown) => {
      store.set(hash, payload);
    }),
  };
}

const fakeHash = (input: string) => `hash:${input.length}:${input.slice(0, 8)}`;

describe('parseItineraryText', () => {
  it('returns err when text is empty', async () => {
    const tripRepo = new DrizzleTripRepository(db);
    const refRepo = new DrizzleCountryReferenceRepository(db);
    const result = await parseItineraryText(
      tripRepo,
      refRepo,
      makeParserStub([]),
      makeCacheStub(),
      fakeHash,
      { tripId: crypto.randomUUID(), text: '   ' },
    );
    expect(result.ok).toBe(false);
  });

  it('returns err when trip is unknown', async () => {
    const tripRepo = new DrizzleTripRepository(db);
    const refRepo = new DrizzleCountryReferenceRepository(db);
    const result = await parseItineraryText(
      tripRepo,
      refRepo,
      makeParserStub([]),
      makeCacheStub(),
      fakeHash,
      { tripId: crypto.randomUUID(), text: 'Vietnam 3 weeks' },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('Trip not found');
  });

  it('enriches rows with country-reference budget when LLM omitted it', async () => {
    const { id: ownerId } = await seedUser(db);
    const trip = await seedTrip(db, ownerId);
    await seedCountryReference(db, {
      country: 'Vietnam',
      alpha2: 'VN',
      alpha3: 'VNM',
      avgDailyCostPence: 5_000,
    });
    const tripRepo = new DrizzleTripRepository(db);
    const refRepo = new DrizzleCountryReferenceRepository(db);
    const parser = makeParserStub([makeRow()]);

    const result = await parseItineraryText(tripRepo, refRepo, parser, makeCacheStub(), fakeHash, {
      tripId: trip.id,
      text: '3 weeks Vietnam from Aug 1',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.rows).toHaveLength(1);
      const row = result.value.rows[0];
      expect(row.country).toBe('Vietnam');
      expect(row.suggestedBudgetPence).not.toBeNull();
      expect((row.suggestedBudgetPence ?? 0) > 0).toBe(true);
    }
  });

  it('serves from cache on identical input without calling the parser twice', async () => {
    const { id: ownerId } = await seedUser(db);
    const trip = await seedTrip(db, ownerId);
    const tripRepo = new DrizzleTripRepository(db);
    const refRepo = new DrizzleCountryReferenceRepository(db);
    const parser = makeParserStub([makeRow()]);
    const cache = makeCacheStub();

    const text = '3 weeks Vietnam from Aug 1';
    await parseItineraryText(tripRepo, refRepo, parser, cache, fakeHash, {
      tripId: trip.id,
      text,
    });
    await parseItineraryText(tripRepo, refRepo, parser, cache, fakeHash, {
      tripId: trip.id,
      text,
    });

    expect(parser.parse).toHaveBeenCalledTimes(1);
  });

  it('passes the parser failure error through', async () => {
    const { id: ownerId } = await seedUser(db);
    const trip = await seedTrip(db, ownerId);
    const tripRepo = new DrizzleTripRepository(db);
    const refRepo = new DrizzleCountryReferenceRepository(db);
    const failingParser: ItineraryParser = {
      parse: async () => ({ ok: false, error: 'rate limit' }),
    };
    const result = await parseItineraryText(
      tripRepo,
      refRepo,
      failingParser,
      makeCacheStub(),
      fakeHash,
      { tripId: trip.id, text: 'foo' },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('rate limit');
  });
});
