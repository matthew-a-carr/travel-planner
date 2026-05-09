import type { ItineraryParser, ParseItineraryOutcome } from '@/application/ports/itinerary-parser';

/**
 * Fallback parser used when no AI Gateway credentials are available
 * (no `AI_GATEWAY_API_KEY` in local dev / CI, and no `VERCEL_OIDC_TOKEN`
 * because we're not running on Vercel). Returns a clear error so the UI
 * can prompt the operator to configure the gateway, but does not throw —
 * so the rest of the app keeps working.
 */
export class NoOpItineraryParser implements ItineraryParser {
  async parse(): Promise<ParseItineraryOutcome> {
    return {
      ok: false,
      error:
        'Itinerary parsing is unavailable: no AI Gateway credentials (AI_GATEWAY_API_KEY or VERCEL_OIDC_TOKEN) are configured.',
    };
  }
}
