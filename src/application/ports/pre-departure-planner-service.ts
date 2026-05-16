import type { PreDeparturePlan } from '@/domain/pre-departure/types';
import type { Destination, Trip, TripFixedCost } from '@/domain/trip/types';

export type PreDeparturePlanInput = {
  readonly trip: Trip;
  readonly destinations: readonly Destination[];
  readonly fixedCosts: readonly TripFixedCost[];
  /** Reference date for "this is the lead time you need" calculations.
   *  Adapter passes the request's "now" so the lead-time calculations
   *  are paced against today, not against the model's wall clock. */
  readonly currentDate: Date;
};

export type PreDeparturePlanOutcome =
  | { readonly ok: true; readonly result: PreDeparturePlan }
  | { readonly ok: false; readonly error: string };

/**
 * AI-only port that proposes pre-departure checklist items (visas,
 * vaccinations, insurance, banking, admin) plus inter-country
 * transport legs for the trip. Reuses the same port/adapter/no-op
 * pattern as `ItineraryParser` / `TimelineInsightsService` /
 * `TripNarrativeService`. See ADR 045.
 */
export interface PreDeparturePlannerService {
  plan(input: PreDeparturePlanInput): Promise<PreDeparturePlanOutcome>;
}
