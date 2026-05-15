import type { AiCacheRepository } from '@/application/ports/ai-cache-repository';
import type { ItineraryParser } from '@/application/ports/itinerary-parser';
import { findReference, suggestBudget } from '@/domain/country-reference/country-reference';
import type { CountryReferenceRepository } from '@/domain/country-reference/country-reference-repository';
import type { CountryReference } from '@/domain/country-reference/types';
import type { ParsedItineraryResult, ParsedItineraryRow } from '@/domain/timeline/types';
import type { TripRepository } from '@/domain/trip/trip-repository';
import type { Result } from '@/domain/trip/types';
import { err, ok } from '@/domain/trip/types';

const PARSE_CACHE_TTL_SECONDS = 7 * 24 * 60 * 60;
const PARSE_CACHE_KIND = 'itinerary-parse-v1';

export type ParseItineraryRequest = {
  /**
   * Optional. When provided, the use case asserts the trip exists before
   * doing any LLM work — this is the per-trip "paste from the timeline tab"
   * path. When omitted, the use case skips the existence check so the
   * create-trip flow can call the same parser before a trip exists. Both
   * paths still share the same cache and country-reference enrichment.
   */
  readonly tripId?: string;
  readonly text: string;
};

export async function parseItineraryText(
  tripRepo: TripRepository,
  countryRefRepo: CountryReferenceRepository,
  parser: ItineraryParser,
  cache: AiCacheRepository,
  hashFn: (input: string) => string,
  request: ParseItineraryRequest,
): Promise<Result<ParsedItineraryResult>> {
  const text = request.text.trim();
  if (text.length === 0) {
    return err('Itinerary text is empty');
  }
  if (text.length > 12_000) {
    return err('Itinerary text is too long (max 12,000 characters)');
  }

  if (request.tripId !== undefined) {
    const trip = await tripRepo.findById(request.tripId);
    if (!trip) return err(`Trip not found: ${request.tripId}`);
  }

  const references = await countryRefRepo.findAll();
  const knownCountries = references.map((r) => r.country);
  const cacheKey = hashFn(`${PARSE_CACHE_KIND}:${text}`);

  const cached = await cache.get<ParsedItineraryResult>(cacheKey);
  if (cached) return ok(enrichRows(cached, references));

  const outcome = await parser.parse({
    text,
    referenceDate: new Date().toISOString().slice(0, 10),
    knownCountries,
  });
  if (!outcome.ok) return err(outcome.error);

  const enriched = enrichRows(outcome.result, references);
  await cache.set(cacheKey, outcome.result, PARSE_CACHE_TTL_SECONDS);
  return ok(enriched);
}

function enrichRows(
  parsed: ParsedItineraryResult,
  references: readonly CountryReference[],
): ParsedItineraryResult {
  const rows = parsed.rows.map((row) => enrichRow(row, references));
  return { rows, unresolved: parsed.unresolved };
}

function enrichRow(
  row: ParsedItineraryRow,
  references: readonly CountryReference[],
): ParsedItineraryRow {
  if (row.suggestedBudgetPence !== null) return row;

  const ref = findReference(row.country, references);
  if (!ref) return row;

  const country = ref.country;
  if (row.startDate === null || row.endDate === null) {
    return { ...row, country };
  }

  const ms = row.endDate.getTime() - row.startDate.getTime();
  const days = Math.max(1, Math.ceil(ms / (1000 * 60 * 60 * 24)));
  const comfort = row.comfortLevel ?? 'mid';
  const suggested = suggestBudget(days, ref, comfort);

  return {
    ...row,
    country,
    suggestedBudgetPence: suggested.amountPence,
  };
}
