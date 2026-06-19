import type { TimelineFinding } from '@/domain/timeline/types';
import type { Destination, TripFixedCost } from '@/domain/trip/types';

export type AnalyseTimelineInput = {
  readonly destinations: readonly Destination[];
  readonly fixedCosts: readonly TripFixedCost[];
  /**
   * Traveller passport nationality display name(s), e.g. ["United Kingdom"].
   * Drives visa-related findings. Empty/omitted falls back to the UK.
   */
  readonly nationalities?: readonly string[];
};

export type AnalyseTimelineOutcome =
  | { readonly ok: true; readonly findings: readonly TimelineFinding[] }
  | { readonly ok: false; readonly error: string };

/**
 * AI-only timeline analyser. Implementations focus on the kinds that can't
 * be derived deterministically from trip data — at minimum 'seasonality'
 * and 'transport-missing'. Deterministic findings (gap/overlap/budget) are
 * computed in the use case and merged with these.
 */
export interface TimelineInsightsService {
  analyse(input: AnalyseTimelineInput): Promise<AnalyseTimelineOutcome>;
}
