import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DestinationRepository } from '@/domain/destination/destination-repository';
import type { SpendEntryRepository } from '@/domain/spending/spend-entry-repository';
import type { TripFixedCostRepository } from '@/domain/trip/fixed-cost-repository';
import type { TripRepository } from '@/domain/trip/trip-repository';
import { createAiServices } from './create-ai-services';

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

  it('always returns wired AI services — real-vs-fallback is decided per call, not at construction', () => {
    vi.stubEnv('AI_GATEWAY_API_KEY', '');
    vi.stubEnv('VERCEL', '');

    const services = createAiServices(stubChatToolDeps);

    expect(services.itineraryParser).toBeDefined();
    expect(services.timelineInsightsService).toBeDefined();
    expect(services.chatAssistant).toBeDefined();
    expect(typeof services.itineraryParser.parse).toBe('function');
    expect(typeof services.timelineInsightsService.analyse).toBe('function');
    expect(typeof services.chatAssistant.streamReply).toBe('function');
  });

  it('routes the chat assistant to the no-op fallback when credentials are absent at call time', async () => {
    vi.stubEnv('AI_GATEWAY_API_KEY', '');
    vi.stubEnv('VERCEL', '');

    const services = createAiServices(stubChatToolDeps);
    const outcome = await services.chatAssistant.streamReply({
      tripId: 'trip-1',
      history: [],
    });

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.error).toMatch(/unavailable/i);
  });

  it('routes the itinerary parser to the no-op fallback when credentials are absent at call time', async () => {
    vi.stubEnv('AI_GATEWAY_API_KEY', '');
    vi.stubEnv('VERCEL', '');

    const services = createAiServices(stubChatToolDeps);
    const outcome = await services.itineraryParser.parse({
      text: 'anything',
      referenceDate: '2026-05-09',
      knownCountries: [],
    });

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.error).toMatch(/unavailable/i);
  });

  it('routes the timeline insights to the no-op fallback (empty findings) when credentials are absent', async () => {
    vi.stubEnv('AI_GATEWAY_API_KEY', '');
    vi.stubEnv('VERCEL', '');

    const services = createAiServices(stubChatToolDeps);
    const outcome = await services.timelineInsightsService.analyse({
      destinations: [],
      fixedCosts: [],
    });

    expect(outcome.ok).toBe(true);
    if (outcome.ok) expect(outcome.findings).toEqual([]);
  });

  it('flips routing when env changes between calls — same container instance', async () => {
    vi.stubEnv('AI_GATEWAY_API_KEY', '');
    vi.stubEnv('VERCEL', '');
    const services = createAiServices(stubChatToolDeps);

    // First call: no credentials → fallback
    const first = await services.chatAssistant.streamReply({ tripId: 'trip-1', history: [] });
    expect(first.ok).toBe(false);

    // Now imagine the worker has been warmed and the request env is
    // different. The same container instance should pick up the new state
    // because the predicate is re-evaluated on every call. We don't actually
    // hit the gateway here — we only assert the assistant did NOT short-
    // circuit to the no-op (it would attempt the real call instead).
    vi.stubEnv('AI_GATEWAY_API_KEY', 'sk-fake-test-key');

    const second = await services.chatAssistant.streamReply({ tripId: 'trip-1', history: [] });
    if (!second.ok) {
      expect(second.error).not.toMatch(/unavailable: set AI_GATEWAY_API_KEY/);
    }
  });
});
