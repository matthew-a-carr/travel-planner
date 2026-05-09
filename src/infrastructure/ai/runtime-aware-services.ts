import type { ChatAssistantService } from '@/application/ports/chat-assistant';
import type { ItineraryParser } from '@/application/ports/itinerary-parser';
import type { TimelineInsightsService } from '@/application/ports/timeline-insights-service';
import { hasAiCredentials } from './vercel-gateway-client';

/**
 * Per-request routing wrappers for the AI services.
 *
 * Why these exist
 * ───────────────
 * Vercel delivers the AI Gateway OIDC token per **request** via the
 * `x-vercel-oidc-token` header. The container that wires
 * `chatAssistant`/`itineraryParser`/`timelineInsightsService` is built once
 * per process (singleton) — so any `hasAiCredentials()` check that runs at
 * construction time freezes the answer for the lifetime of the worker.
 * If the first call into the container ever happened in a context where the
 * env signal was absent (a build-time pre-render, a cold start before
 * env wiring, etc.), every subsequent request would silently route to the
 * no-op fallback even after credentials were available.
 *
 * The container is still the dependency-injection seam — it wires *one*
 * `ChatAssistantService` (etc.) for the whole app. We just wire a wrapper
 * that re-checks `hasAiCredentials()` on every method call and delegates
 * to either the real implementation or the no-op fallback. The decision
 * is taken at request time, not at boot time.
 *
 * Each helper is intentionally tiny: a single-method async router. No
 * shared state between calls. Testable with deterministic predicate
 * overrides via the `hasCredentials` parameter.
 */

type Predicate = () => boolean;

export function runtimeAwareChatAssistant(
  real: ChatAssistantService,
  fallback: ChatAssistantService,
  hasCredentials: Predicate = hasAiCredentials,
): ChatAssistantService {
  return {
    streamReply: (input) => (hasCredentials() ? real : fallback).streamReply(input),
  };
}

export function runtimeAwareItineraryParser(
  real: ItineraryParser,
  fallback: ItineraryParser,
  hasCredentials: Predicate = hasAiCredentials,
): ItineraryParser {
  return {
    parse: (input) => (hasCredentials() ? real : fallback).parse(input),
  };
}

export function runtimeAwareTimelineInsights(
  real: TimelineInsightsService,
  fallback: TimelineInsightsService,
  hasCredentials: Predicate = hasAiCredentials,
): TimelineInsightsService {
  return {
    analyse: (input) => (hasCredentials() ? real : fallback).analyse(input),
  };
}
