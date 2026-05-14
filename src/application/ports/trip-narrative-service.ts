import type { Destination, SpendEntry, Trip, TripFixedCost } from '@/domain/trip/types';

export type TripNarrativeInput = {
  readonly trip: Trip;
  readonly destinations: readonly Destination[];
  readonly fixedCosts: readonly TripFixedCost[];
  readonly spendEntries: readonly SpendEntry[];
  /** Reference date used to project pace / detect alerts. Caller passes
   *  the request's "now" so the narrative is paced against today, not
   *  against the model's wall clock. */
  readonly currentDate: Date;
};

export type TripNarrativeResult = {
  /** 2–3 sentence paragraph explaining the budget state in plain English.
   *  Empty string means "no narrative available" — UI hides the panel. */
  readonly narrative: string;
  /** 0–3 short imperative suggestions. UI renders as a bullet list when
   *  non-empty. */
  readonly bullets: readonly string[];
};

export type TripNarrativeOutcome =
  | { readonly ok: true; readonly result: TripNarrativeResult }
  | { readonly ok: false; readonly error: string };

/**
 * AI-only port that generates a passive "so what?" narrative for the
 * trip overview. Reuses the same port/adapter/no-op pattern as
 * `ItineraryParser`, `TimelineInsightsService`, and
 * `ChatAssistantService`. See ADR 043.
 */
export interface TripNarrativeService {
  summarise(input: TripNarrativeInput): Promise<TripNarrativeOutcome>;
}
