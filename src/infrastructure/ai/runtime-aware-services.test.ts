import { describe, expect, it, vi } from 'vitest';
import type { ChatAssistantService } from '@/application/ports/chat-assistant';
import type { ItineraryParser } from '@/application/ports/itinerary-parser';
import type { TimelineInsightsService } from '@/application/ports/timeline-insights-service';
import {
  runtimeAwareChatAssistant,
  runtimeAwareItineraryParser,
  runtimeAwareTimelineInsights,
} from './runtime-aware-services';

async function* fromChunks(chunks: readonly string[]): AsyncIterable<string> {
  for (const chunk of chunks) yield chunk;
}

const realChat: ChatAssistantService = {
  streamReply: vi.fn().mockResolvedValue({ ok: true, textStream: fromChunks(['real']) }),
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

const chatInput = { tripId: 't', history: [] } as const;
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
