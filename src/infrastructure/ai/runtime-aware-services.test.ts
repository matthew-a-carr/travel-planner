import { describe, expect, it, vi } from 'vitest';
import type { ChatAssistantService } from '@/application/ports/chat-assistant';
import type { ItineraryParser } from '@/application/ports/itinerary-parser';
import type { PreDeparturePlannerService } from '@/application/ports/pre-departure-planner-service';
import type { TimelineInsightsService } from '@/application/ports/timeline-insights-service';
import type { TripNarrativeService } from '@/application/ports/trip-narrative-service';
import {
  runtimeAwareChatAssistant,
  runtimeAwareItineraryParser,
  runtimeAwarePreDeparturePlanner,
  runtimeAwareTimelineInsights,
  runtimeAwareTripNarrative,
} from './runtime-aware-services';

const realChat: ChatAssistantService = {
  streamReply: vi.fn().mockResolvedValue({
    ok: true,
    response: new Response('real', { status: 200 }),
  }),
};
const fallbackChat: ChatAssistantService = {
  streamReply: vi.fn().mockResolvedValue({ ok: false, error: 'fallback' }),
};

const realParser: ItineraryParser = {
  parse: vi.fn().mockResolvedValue({ ok: true, destinations: [] }),
};
const fallbackParser: ItineraryParser = {
  parse: vi.fn().mockResolvedValue({ ok: false, error: 'fallback' }),
};

const realInsights: TimelineInsightsService = {
  analyse: vi.fn().mockResolvedValue({ ok: true, findings: [{ kind: 'real' }] }),
};
const fallbackInsights: TimelineInsightsService = {
  analyse: vi.fn().mockResolvedValue({ ok: true, findings: [] }),
};

const realNarrative: TripNarrativeService = {
  summarise: vi
    .fn()
    .mockResolvedValue({ ok: true, result: { narrative: 'real', bullets: [] } }),
};
const fallbackNarrative: TripNarrativeService = {
  summarise: vi
    .fn()
    .mockResolvedValue({ ok: true, result: { narrative: '', bullets: [] } }),
};

const realPlanner: PreDeparturePlannerService = {
  plan: vi.fn().mockResolvedValue({
    ok: true,
    result: {
      items: [{ title: 'real', category: 'visa', dueDate: null, costPence: null, suggestion: null, verifyAt: null }],
      transportLegs: [],
    },
  }),
};
const fallbackPlanner: PreDeparturePlannerService = {
  plan: vi
    .fn()
    .mockResolvedValue({ ok: true, result: { items: [], transportLegs: [] } }),
};

const plannerInput = {
  trip: {} as Parameters<PreDeparturePlannerService['plan']>[0]['trip'],
  destinations: [],
  fixedCosts: [],
  currentDate: new Date('2026-05-15'),
} as Parameters<PreDeparturePlannerService['plan']>[0];

const narrativeInput = {
  trip: {} as Parameters<TripNarrativeService['summarise']>[0]['trip'],
  destinations: [],
  fixedCosts: [],
  spendEntries: [],
  currentDate: new Date('2026-08-01'),
} as Parameters<TripNarrativeService['summarise']>[0];

const chatInput = {
  tripId: 't',
  history: [],
  onFinish: async () => {},
} as const;
const parserInput = { text: 'x', referenceDate: '2026-05-09', knownCountries: [] } as const;
const insightsInput = { destinations: [], fixedCosts: [] } as const;

describe('runtimeAwareChatAssistant', () => {
  it('routes to the real implementation when credentials are present', async () => {
    const service = runtimeAwareChatAssistant(realChat, fallbackChat, () => true);
    const outcome = await service.streamReply(chatInput);
    expect(outcome.ok).toBe(true);
  });

  it('routes to the fallback when credentials are absent', async () => {
    const service = runtimeAwareChatAssistant(realChat, fallbackChat, () => false);
    const outcome = await service.streamReply(chatInput);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.error).toBe('fallback');
  });

  it('re-evaluates the predicate on every call — the decision is per-request, not cached', async () => {
    let credentialsAvailable = false;
    const service = runtimeAwareChatAssistant(
      realChat,
      fallbackChat,
      () => credentialsAvailable,
    );

    const first = await service.streamReply(chatInput);
    expect(first.ok).toBe(false); // fallback

    credentialsAvailable = true;
    const second = await service.streamReply(chatInput);
    expect(second.ok).toBe(true); // real

    credentialsAvailable = false;
    const third = await service.streamReply(chatInput);
    expect(third.ok).toBe(false); // fallback again
  });
});

describe('runtimeAwareItineraryParser', () => {
  it('routes to the real implementation when credentials are present', async () => {
    const service = runtimeAwareItineraryParser(realParser, fallbackParser, () => true);
    const outcome = await service.parse(parserInput);
    expect(outcome.ok).toBe(true);
  });

  it('routes to the fallback when credentials are absent', async () => {
    const service = runtimeAwareItineraryParser(realParser, fallbackParser, () => false);
    const outcome = await service.parse(parserInput);
    expect(outcome.ok).toBe(false);
  });

  it('re-evaluates the predicate on every call', async () => {
    let creds = false;
    const service = runtimeAwareItineraryParser(realParser, fallbackParser, () => creds);
    expect((await service.parse(parserInput)).ok).toBe(false);
    creds = true;
    expect((await service.parse(parserInput)).ok).toBe(true);
  });
});

describe('runtimeAwareTimelineInsights', () => {
  it('routes to the real implementation when credentials are present', async () => {
    const service = runtimeAwareTimelineInsights(realInsights, fallbackInsights, () => true);
    const outcome = await service.analyse(insightsInput);
    expect(outcome.ok).toBe(true);
    if (outcome.ok) expect(outcome.findings).toHaveLength(1);
  });

  it('routes to the fallback when credentials are absent', async () => {
    const service = runtimeAwareTimelineInsights(realInsights, fallbackInsights, () => false);
    const outcome = await service.analyse(insightsInput);
    expect(outcome.ok).toBe(true);
    if (outcome.ok) expect(outcome.findings).toHaveLength(0);
  });
});

describe('runtimeAwareTripNarrative', () => {
  it('routes to the real implementation when credentials are present', async () => {
    const service = runtimeAwareTripNarrative(realNarrative, fallbackNarrative, () => true);
    const outcome = await service.summarise(narrativeInput);
    expect(outcome.ok).toBe(true);
    if (outcome.ok) expect(outcome.result.narrative).toBe('real');
  });

  it('routes to the fallback when credentials are absent', async () => {
    const service = runtimeAwareTripNarrative(realNarrative, fallbackNarrative, () => false);
    const outcome = await service.summarise(narrativeInput);
    expect(outcome.ok).toBe(true);
    if (outcome.ok) expect(outcome.result.narrative).toBe('');
  });

  it('re-evaluates the predicate on every call', async () => {
    let creds = false;
    const service = runtimeAwareTripNarrative(
      realNarrative,
      fallbackNarrative,
      () => creds,
    );
    const first = await service.summarise(narrativeInput);
    expect(first.ok && first.result.narrative).toBe('');
    creds = true;
    const second = await service.summarise(narrativeInput);
    expect(second.ok && second.result.narrative).toBe('real');
  });
});

describe('runtimeAwarePreDeparturePlanner', () => {
  it('routes to the real implementation when credentials are present', async () => {
    const service = runtimeAwarePreDeparturePlanner(realPlanner, fallbackPlanner, () => true);
    const outcome = await service.plan(plannerInput);
    expect(outcome.ok).toBe(true);
    if (outcome.ok) expect(outcome.result.items).toHaveLength(1);
  });

  it('routes to the fallback when credentials are absent', async () => {
    const service = runtimeAwarePreDeparturePlanner(realPlanner, fallbackPlanner, () => false);
    const outcome = await service.plan(plannerInput);
    expect(outcome.ok).toBe(true);
    if (outcome.ok) expect(outcome.result.items).toHaveLength(0);
  });
});
