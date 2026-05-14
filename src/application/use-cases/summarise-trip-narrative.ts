import type { AiCacheRepository } from '@/application/ports/ai-cache-repository';
import type {
  TripNarrativeResult,
  TripNarrativeService,
} from '@/application/ports/trip-narrative-service';
import type { DestinationRepository } from '@/domain/destination/destination-repository';
import type { SpendEntryRepository } from '@/domain/spending/spend-entry-repository';
import type { TripFixedCostRepository } from '@/domain/trip/fixed-cost-repository';
import type { TripRepository } from '@/domain/trip/trip-repository';
import type { Destination, Result, SpendEntry, Trip, TripFixedCost } from '@/domain/trip/types';
import { err, ok } from '@/domain/trip/types';

const NARRATIVE_CACHE_TTL_SECONDS = 6 * 60 * 60;
const NARRATIVE_CACHE_KIND = 'trip-narrative-v1';

const EMPTY_NARRATIVE: TripNarrativeResult = {
  narrative: '',
  bullets: [],
};

export async function summariseTripNarrative(
  tripRepo: TripRepository,
  destRepo: DestinationRepository,
  fixedCostRepo: TripFixedCostRepository,
  spendRepo: SpendEntryRepository,
  narrative: TripNarrativeService,
  cache: AiCacheRepository,
  hashFn: (input: string) => string,
  tripId: string,
  currentDate: Date,
): Promise<Result<TripNarrativeResult>> {
  const trip = await tripRepo.findById(tripId);
  if (!trip) return err(`Trip not found: ${tripId}`);

  const [destinations, fixedCosts, spendEntries] = await Promise.all([
    destRepo.findByTrip(tripId),
    fixedCostRepo.findByTrip(tripId),
    spendRepo.findByTrip(tripId),
  ]);

  const cacheKey = hashFn(
    `${NARRATIVE_CACHE_KIND}:${stableStateKey(trip, destinations, fixedCosts, spendEntries, currentDate)}`,
  );

  const cached = await cache.get<TripNarrativeResult>(cacheKey);
  if (cached) return ok(cached);

  const outcome = await narrative.summarise({
    trip,
    destinations,
    fixedCosts,
    spendEntries,
    currentDate,
  });

  if (!outcome.ok) {
    return ok(EMPTY_NARRATIVE);
  }

  await cache.set(cacheKey, outcome.result, NARRATIVE_CACHE_TTL_SECONDS);
  return ok(outcome.result);
}

function stableStateKey(
  trip: Trip,
  destinations: readonly Destination[],
  fixedCosts: readonly TripFixedCost[],
  spendEntries: readonly SpendEntry[],
  currentDate: Date,
): string {
  const destPart = [...destinations]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map(
      (d) =>
        `${d.id}|${d.country}|${d.city ?? ''}|${d.comfortLevel}|${d.startDate?.toISOString() ?? ''}|${d.endDate?.toISOString() ?? ''}|${d.estimatedBudget.amountPence}`,
    )
    .join(';');
  const costPart = [...fixedCosts]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((f) => `${f.id}|${f.date.toISOString()}|${f.amount.amountPence}|${f.category}`)
    .join(';');
  const spendTotal = spendEntries.reduce((sum, e) => sum + e.amount.amountPence, 0);
  const spendPart = `${spendEntries.length}|${spendTotal}`;
  const dayPart = currentDate.toISOString().slice(0, 10);
  return `${trip.id}|${trip.status}|${trip.totalBudget.amountPence}::${destPart}::${costPart}::${spendPart}::${dayPart}`;
}
