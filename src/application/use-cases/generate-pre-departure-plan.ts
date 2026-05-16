import type { AiCacheRepository } from '@/application/ports/ai-cache-repository';
import type { PreDeparturePlannerService } from '@/application/ports/pre-departure-planner-service';
import type { DestinationRepository } from '@/domain/destination/destination-repository';
import type { PreDeparturePlan } from '@/domain/pre-departure/types';
import type { TripFixedCostRepository } from '@/domain/trip/fixed-cost-repository';
import type { TripRepository } from '@/domain/trip/trip-repository';
import type { Destination, Result, Trip, TripFixedCost } from '@/domain/trip/types';
import { err, ok } from '@/domain/trip/types';

const PLAN_CACHE_TTL_SECONDS = 24 * 60 * 60;
const PLAN_CACHE_KIND = 'pre-departure-plan-v1';

const EMPTY_PLAN: PreDeparturePlan = { items: [], transportLegs: [] };

type CachedPlan = {
  items: {
    title: string;
    category: string;
    dueDate: string | null;
    costPence: number | null;
    suggestion: string | null;
    verifyAt: string | null;
  }[];
  transportLegs: {
    fromDestinationId: string;
    toDestinationId: string;
    mode: string;
    typicalCostPence: number;
    bookingLeadDays: number;
    notes: string | null;
  }[];
};

export async function generatePreDeparturePlan(
  tripRepo: TripRepository,
  destRepo: DestinationRepository,
  fixedCostRepo: TripFixedCostRepository,
  planner: PreDeparturePlannerService,
  cache: AiCacheRepository,
  hashFn: (input: string) => string,
  tripId: string,
  currentDate: Date,
): Promise<Result<PreDeparturePlan>> {
  const trip = await tripRepo.findById(tripId);
  if (!trip) return err(`Trip not found: ${tripId}`);

  const [destinations, fixedCosts] = await Promise.all([
    destRepo.findByTrip(tripId),
    fixedCostRepo.findByTrip(tripId),
  ]);

  const cacheKey = hashFn(
    `${PLAN_CACHE_KIND}:${stableStateKey(trip, destinations, fixedCosts, currentDate)}`,
  );

  const cached = await cache.get<CachedPlan>(cacheKey);
  if (cached) return ok(hydratePlan(cached));

  const outcome = await planner.plan({
    trip,
    destinations,
    fixedCosts,
    currentDate,
  });

  if (!outcome.ok) {
    return ok(EMPTY_PLAN);
  }

  await cache.set(cacheKey, dehydratePlan(outcome.result), PLAN_CACHE_TTL_SECONDS);
  return ok(outcome.result);
}

function stableStateKey(
  trip: Trip,
  destinations: readonly Destination[],
  fixedCosts: readonly TripFixedCost[],
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
    .map((f) => `${f.id}|${f.date.toISOString()}|${f.amount.amountPence}|${f.category}|${f.label}`)
    .join(';');
  const dayPart = currentDate.toISOString().slice(0, 10);
  return `${trip.id}|${trip.status}|${trip.totalBudget.amountPence}::${destPart}::${costPart}::${dayPart}`;
}

function dehydratePlan(plan: PreDeparturePlan): CachedPlan {
  return {
    items: plan.items.map((i) => ({
      title: i.title,
      category: i.category,
      dueDate: i.dueDate ? i.dueDate.toISOString() : null,
      costPence: i.costPence,
      suggestion: i.suggestion,
      verifyAt: i.verifyAt,
    })),
    transportLegs: plan.transportLegs.map((l) => ({ ...l })),
  };
}

function hydratePlan(cached: CachedPlan): PreDeparturePlan {
  return {
    items: cached.items.map((i) => ({
      title: i.title,
      category: i.category as PreDeparturePlan['items'][number]['category'],
      dueDate: i.dueDate ? new Date(i.dueDate) : null,
      costPence: i.costPence,
      suggestion: i.suggestion,
      verifyAt: i.verifyAt as PreDeparturePlan['items'][number]['verifyAt'],
    })),
    transportLegs: cached.transportLegs.map((l) => ({
      fromDestinationId: l.fromDestinationId,
      toDestinationId: l.toDestinationId,
      mode: l.mode as PreDeparturePlan['transportLegs'][number]['mode'],
      typicalCostPence: l.typicalCostPence,
      bookingLeadDays: l.bookingLeadDays,
      notes: l.notes,
    })),
  };
}
