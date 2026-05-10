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
    const persisted: unknown[] = [];
    const outcome = await services.chatAssistant.streamReply({
      tripId: 'trip-1',
      history: [],
      onFinish: async (parts) => {
        persisted.push(...parts);
      },
    });

    expect(outcome.ok).toBe(true);
    expect(persisted).toEqual([
      expect.objectContaining({ type: 'text', text: expect.stringMatching(/unavailable/i) }),
    ]);
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

    const noop: unknown[] = [];
    // First call: no credentials → fallback. The no-op routes the offline
    // message through the standard onFinish pipeline.
    const first = await services.chatAssistant.streamReply({
      tripId: 'trip-1',
      history: [],
      onFinish: async (parts) => {
        noop.push(...parts);
      },
    });
    expect(first.ok).toBe(true);
    expect(noop).toEqual([
      expect.objectContaining({ type: 'text', text: expect.stringMatching(/unavailable/i) }),
    ]);

    // Now imagine the worker has been warmed and the request env is
    // different. The same container instance should pick up the new state
    // because the predicate is re-evaluated on every call. We don't actually
    // hit the gateway here — we only assert the assistant did NOT short-
    // circuit to the no-op (it would attempt the real call and persist
    // nothing through onFinish for the no-op offline path).
    vi.stubEnv('AI_GATEWAY_API_KEY', 'sk-fake-test-key');
    const real: unknown[] = [];
    const second = await services.chatAssistant.streamReply({
      tripId: 'trip-1',
      history: [],
      onFinish: async (parts) => {
        real.push(...parts);
      },
    });
    // Real adapter may not actually fire onFinish in this test (no AI
    // Gateway response), but it must not synchronously persist the offline
    // message — that would mean we fell back instead of attempting the
    // real call.
    expect(real).not.toEqual([
      expect.objectContaining({ type: 'text', text: expect.stringMatching(/unavailable/i) }),
    ]);
    expect(second).toBeDefined();
  });
});
