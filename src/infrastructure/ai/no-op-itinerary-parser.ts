import type { ItineraryParser, ParseItineraryOutcome } from '@/application/ports/itinerary-parser';

/**
 * Fallback parser used when AI_GATEWAY_API_KEY is unset (local dev / CI).
 * Returns a clear error so the UI can prompt the operator to configure the
 * gateway, but does not throw — so the rest of the app keeps working.
 */
export class NoOpItineraryParser implements ItineraryParser {
  async parse(): Promise<ParseItineraryOutcome> {
    return {
      ok: false,
      error: 'Itinerary parsing is unavailable: AI_GATEWAY_API_KEY is not configured.',
    };
  }
}
