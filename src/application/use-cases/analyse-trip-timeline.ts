import type { AiCacheRepository } from '@/application/ports/ai-cache-repository';
import type { TimelineInsightsService } from '@/application/ports/timeline-insights-service';
import type { CountryReferenceRepository } from '@/domain/country-reference/country-reference-repository';
import type { DestinationRepository } from '@/domain/destination/destination-repository';
import { detectDeterministicFindings, mergeFindings } from '@/domain/timeline/timeline';
import type { TimelineFinding } from '@/domain/timeline/types';
import type { TripFixedCostRepository } from '@/domain/trip/fixed-cost-repository';
import type { TripRepository } from '@/domain/trip/trip-repository';
import type { Result } from '@/domain/trip/types';
import { err, ok } from '@/domain/trip/types';

const INSIGHTS_CACHE_TTL_SECONDS = 24 * 60 * 60;
const INSIGHTS_CACHE_KIND = 'timeline-insights-v1';

export async function analyseTripTimeline(
  tripRepo: TripRepository,
  destRepo: DestinationRepository,
  fixedCostRepo: TripFixedCostRepository,
  countryRefRepo: CountryReferenceRepository,
  insights: TimelineInsightsService,
  cache: AiCacheRepository,
  hashFn: (input: string) => string,
  tripId: string,
): Promise<Result<readonly TimelineFinding[]>> {
  const trip = await tripRepo.findById(tripId);
  if (!trip) return err(`Trip not found: ${tripId}`);

  const [destinations, fixedCosts, references] = await Promise.all([
    destRepo.findByTrip(tripId),
    fixedCostRepo.findByTrip(tripId),
    countryRefRepo.findAll(),
  ]);

  const deterministic = detectDeterministicFindings(destinations, references);

  const cacheKey = hashFn(`${INSIGHTS_CACHE_KIND}:${stableStateKey(destinations, fixedCosts)}`);
  let aiFindings: readonly TimelineFinding[];
  const cached = await cache.get<readonly TimelineFinding[]>(cacheKey);
  if (cached) {
    aiFindings = cached;
  } else {
    const outcome = await insights.analyse({ destinations, fixedCosts });
    if (!outcome.ok) {
      // AI is best-effort — return deterministic findings on AI failure.
      return ok(deterministic);
    }
    aiFindings = outcome.findings;
    await cache.set(cacheKey, aiFindings, INSIGHTS_CACHE_TTL_SECONDS);
  }

  return ok(mergeFindings(deterministic, aiFindings));
}

function stableStateKey(
  destinations: ReadonlyArray<{
    readonly id: string;
    readonly country: string;
    readonly city: string | null;
    readonly comfortLevel: string;
    readonly startDate: Date | null;
    readonly endDate: Date | null;
    readonly estimatedBudget: { readonly amountPence: number };
  }>,
  fixedCosts: ReadonlyArray<{
    readonly id: string;
    readonly date: Date;
    readonly amount: { readonly amountPence: number };
    readonly category: string;
  }>,
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
  return `${destPart}::${costPart}`;
}
