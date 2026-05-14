import type {
  TripNarrativeOutcome,
  TripNarrativeService,
} from '@/application/ports/trip-narrative-service';

/**
 * Fallback narrative service used when AI_GATEWAY_API_KEY is unset and the
 * runtime-aware router falls back. Returns an empty narrative so the
 * overview page hides the panel — same silent-degradation pattern as
 * `NoOpTimelineInsights`.
 */
export class NoOpTripNarrativeService implements TripNarrativeService {
  async summarise(): Promise<TripNarrativeOutcome> {
    return { ok: true, result: { narrative: '', bullets: [] } };
  }
}
