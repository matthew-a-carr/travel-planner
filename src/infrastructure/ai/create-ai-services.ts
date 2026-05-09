import type { ItineraryParser } from '@/application/ports/itinerary-parser';
import type { TimelineInsightsService } from '@/application/ports/timeline-insights-service';
import { AnthropicItineraryParser } from './anthropic-itinerary-parser';
import { AnthropicTimelineInsights } from './anthropic-timeline-insights';
import { NoOpItineraryParser } from './no-op-itinerary-parser';
import { NoOpTimelineInsights } from './no-op-timeline-insights';
import { gatewayModelId, hasAiCredentials } from './vercel-gateway-client';

export type AiServices = {
  readonly itineraryParser: ItineraryParser;
  readonly timelineInsightsService: TimelineInsightsService;
};

/**
 * Build the AI services for the runtime container. Real services are wired
 * when either auth mechanism is available:
 *   - `AI_GATEWAY_API_KEY` (local dev / CI)
 *   - `VERCEL_OIDC_TOKEN` (auto-injected on Vercel deployments)
 *
 * Otherwise the no-op fallbacks are used so the rest of the app still works
 * and the UI surfaces a clear "AI offline" message.
 */
export function createAiServices(): AiServices {
  if (!hasAiCredentials()) {
    return {
      itineraryParser: new NoOpItineraryParser(),
      timelineInsightsService: new NoOpTimelineInsights(),
    };
  }
  const modelId = gatewayModelId();
  return {
    itineraryParser: new AnthropicItineraryParser(modelId),
    timelineInsightsService: new AnthropicTimelineInsights(modelId),
  };
}
