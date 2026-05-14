import type { ChatAssistantService } from '@/application/ports/chat-assistant';
import type { ItineraryParser } from '@/application/ports/itinerary-parser';
import type { TimelineInsightsService } from '@/application/ports/timeline-insights-service';
import type { TripNarrativeService } from '@/application/ports/trip-narrative-service';
import { AnthropicChatAssistant } from './anthropic-chat-assistant';
import { AnthropicItineraryParser } from './anthropic-itinerary-parser';
import { AnthropicTimelineInsights } from './anthropic-timeline-insights';
import type { ChatToolDeps } from './chat-tools';
import { GatewayTripNarrativeService } from './gateway-trip-narrative';
import { NoOpChatAssistant } from './no-op-chat-assistant';
import { NoOpItineraryParser } from './no-op-itinerary-parser';
import { NoOpTimelineInsights } from './no-op-timeline-insights';
import { NoOpTripNarrativeService } from './no-op-trip-narrative';
import {
  runtimeAwareChatAssistant,
  runtimeAwareItineraryParser,
  runtimeAwareTimelineInsights,
  runtimeAwareTripNarrative,
} from './runtime-aware-services';
import { gatewayModelId } from './vercel-gateway-client';

export type AiServices = {
  readonly itineraryParser: ItineraryParser;
  readonly timelineInsightsService: TimelineInsightsService;
  readonly chatAssistant: ChatAssistantService;
  readonly tripNarrativeService: TripNarrativeService;
};

/**
 * Build the AI services for the runtime container.
 *
 * Each service is a runtime-aware router that re-checks `hasAiCredentials()`
 * on every call and delegates to either the real Anthropic-backed
 * implementation or the no-op fallback. The container is still the DI seam
 * — callers receive a single `ChatAssistantService` (etc.) — but the
 * real-vs-fallback decision happens at request time, not at boot time.
 *
 * This matters because the AI Gateway OIDC token is only available
 * per-request on Vercel (the `x-vercel-oidc-token` header), so a check at
 * construction time would freeze the answer for the lifetime of the
 * process. See `runtime-aware-services.ts` and ADR 040.
 *
 * `chatToolDeps` are the read-side repositories the chat assistant binds at
 * call time when constructing per-trip tools. The container wires them in
 * after concrete repositories are constructed.
 */
export function createAiServices(chatToolDeps: ChatToolDeps): AiServices {
  const modelId = gatewayModelId();

  return {
    itineraryParser: runtimeAwareItineraryParser(
      new AnthropicItineraryParser(modelId),
      new NoOpItineraryParser(),
    ),
    timelineInsightsService: runtimeAwareTimelineInsights(
      new AnthropicTimelineInsights(modelId),
      new NoOpTimelineInsights(),
    ),
    chatAssistant: runtimeAwareChatAssistant(
      new AnthropicChatAssistant(modelId, chatToolDeps),
      new NoOpChatAssistant(),
    ),
    tripNarrativeService: runtimeAwareTripNarrative(
      new GatewayTripNarrativeService(modelId),
      new NoOpTripNarrativeService(),
    ),
  };
}
