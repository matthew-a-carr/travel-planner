import type {
  PreDeparturePlannerService,
  PreDeparturePlanOutcome,
} from '@/application/ports/pre-departure-planner-service';

/**
 * Fallback used when AI_GATEWAY_API_KEY is unset and the runtime-aware
 * router falls back. Returns an empty plan so the panel hides cleanly
 * — same silent-degradation pattern as `NoOpTimelineInsights` and
 * `NoOpTripNarrativeService`.
 */
export class NoOpPreDeparturePlannerService implements PreDeparturePlannerService {
  async plan(): Promise<PreDeparturePlanOutcome> {
    return { ok: true, result: { items: [], transportLegs: [] } };
  }
}
