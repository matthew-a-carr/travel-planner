import type { ItineraryParser } from '@/application/ports/itinerary-parser';
import type { TimelineInsightsService } from '@/application/ports/timeline-insights-service';
import { AnthropicItineraryParser } from './anthropic-itinerary-parser';
import { AnthropicTimelineInsights } from './anthropic-timeline-insights';
import { NoOpItineraryParser } from './no-op-itinerary-parser';
import { NoOpTimelineInsights } from './no-op-timeline-insights';
import { createGatewayModel, readGatewayConfig } from './vercel-gateway-client';

export type AiServices = {
  readonly itineraryParser: ItineraryParser;
  readonly timelineInsightsService: TimelineInsightsService;
};

/**
 * Build the AI services for the runtime container. When AI_GATEWAY_API_KEY
 * is unset (local dev without gateway, CI builds, tests) this returns the
 * no-op fallbacks — the rest of the app still works and the UI surfaces a
 * clear "AI unavailable" message.
 */
export function createAiServices(): AiServices {
  const config = readGatewayConfig();
  if (!config) {
    return {
      itineraryParser: new NoOpItineraryParser(),
      timelineInsightsService: new NoOpTimelineInsights(),
    };
  }
  const model = createGatewayModel(config);
  return {
    itineraryParser: new AnthropicItineraryParser(model),
    timelineInsightsService: new AnthropicTimelineInsights(model),
  };
}
