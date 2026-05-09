import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DestinationRepository } from '@/domain/destination/destination-repository';
import type { SpendEntryRepository } from '@/domain/spending/spend-entry-repository';
import type { TripFixedCostRepository } from '@/domain/trip/fixed-cost-repository';
import type { TripRepository } from '@/domain/trip/trip-repository';
import { AnthropicChatAssistant } from './anthropic-chat-assistant';
import { AnthropicItineraryParser } from './anthropic-itinerary-parser';
import { AnthropicTimelineInsights } from './anthropic-timeline-insights';
import { createAiServices } from './create-ai-services';
import { NoOpChatAssistant } from './no-op-chat-assistant';
import { NoOpItineraryParser } from './no-op-itinerary-parser';
import { NoOpTimelineInsights } from './no-op-timeline-insights';

const stubChatToolDeps = {
  tripRepository: {} as TripRepository,
  destinationRepository: {} as DestinationRepository,
  spendEntryRepository: {} as SpendEntryRepository,
  tripFixedCostRepository: {} as TripFixedCostRepository,
};

describe('createAiServices', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('wires no-op services when neither AI_GATEWAY_API_KEY nor VERCEL_OIDC_TOKEN is set', () => {
    vi.stubEnv('AI_GATEWAY_API_KEY', '');
    vi.stubEnv('VERCEL_OIDC_TOKEN', '');

    const services = createAiServices(stubChatToolDeps);

    expect(services.itineraryParser).toBeInstanceOf(NoOpItineraryParser);
    expect(services.timelineInsightsService).toBeInstanceOf(NoOpTimelineInsights);
    expect(services.chatAssistant).toBeInstanceOf(NoOpChatAssistant);
  });

  it('wires no-op services when both env vars are whitespace-only', () => {
    vi.stubEnv('AI_GATEWAY_API_KEY', '   ');
    vi.stubEnv('VERCEL_OIDC_TOKEN', '   ');

    const services = createAiServices(stubChatToolDeps);

    expect(services.itineraryParser).toBeInstanceOf(NoOpItineraryParser);
    expect(services.timelineInsightsService).toBeInstanceOf(NoOpTimelineInsights);
    expect(services.chatAssistant).toBeInstanceOf(NoOpChatAssistant);
  });

  it('wires Anthropic-backed services when AI_GATEWAY_API_KEY is set (local dev / CI)', () => {
    vi.stubEnv('AI_GATEWAY_API_KEY', 'sk-fake-test-key');
    vi.stubEnv('VERCEL_OIDC_TOKEN', '');

    const services = createAiServices(stubChatToolDeps);

    expect(services.itineraryParser).toBeInstanceOf(AnthropicItineraryParser);
    expect(services.timelineInsightsService).toBeInstanceOf(AnthropicTimelineInsights);
    expect(services.chatAssistant).toBeInstanceOf(AnthropicChatAssistant);
  });

  it('wires Anthropic-backed services when only VERCEL_OIDC_TOKEN is set (Vercel deployments)', () => {
    vi.stubEnv('AI_GATEWAY_API_KEY', '');
    vi.stubEnv('VERCEL_OIDC_TOKEN', 'eyJhbGciOiJSUzI1NiIs.fake.oidc-jwt');

    const services = createAiServices(stubChatToolDeps);

    expect(services.itineraryParser).toBeInstanceOf(AnthropicItineraryParser);
    expect(services.timelineInsightsService).toBeInstanceOf(AnthropicTimelineInsights);
    expect(services.chatAssistant).toBeInstanceOf(AnthropicChatAssistant);
  });
});
