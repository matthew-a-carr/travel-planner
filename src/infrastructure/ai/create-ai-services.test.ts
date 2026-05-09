import { afterEach, describe, expect, it, vi } from 'vitest';
import { AnthropicItineraryParser } from './anthropic-itinerary-parser';
import { AnthropicTimelineInsights } from './anthropic-timeline-insights';
import { createAiServices } from './create-ai-services';
import { NoOpItineraryParser } from './no-op-itinerary-parser';
import { NoOpTimelineInsights } from './no-op-timeline-insights';

describe('createAiServices', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('wires no-op services when AI_GATEWAY_API_KEY is unset', () => {
    vi.stubEnv('AI_GATEWAY_API_KEY', '');

    const services = createAiServices();

    expect(services.itineraryParser).toBeInstanceOf(NoOpItineraryParser);
    expect(services.timelineInsightsService).toBeInstanceOf(NoOpTimelineInsights);
  });

  it('wires no-op services when AI_GATEWAY_API_KEY is whitespace-only', () => {
    vi.stubEnv('AI_GATEWAY_API_KEY', '   ');

    const services = createAiServices();

    expect(services.itineraryParser).toBeInstanceOf(NoOpItineraryParser);
    expect(services.timelineInsightsService).toBeInstanceOf(NoOpTimelineInsights);
  });

  it('wires Anthropic-backed services when AI_GATEWAY_API_KEY is set', () => {
    vi.stubEnv('AI_GATEWAY_API_KEY', 'sk-fake-test-key');

    const services = createAiServices();

    expect(services.itineraryParser).toBeInstanceOf(AnthropicItineraryParser);
    expect(services.timelineInsightsService).toBeInstanceOf(AnthropicTimelineInsights);
  });
});
