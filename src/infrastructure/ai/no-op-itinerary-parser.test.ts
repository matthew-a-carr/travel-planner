import { describe, expect, it } from 'vitest';
import { NoOpItineraryParser } from './no-op-itinerary-parser';

describe('NoOpItineraryParser', () => {
  it('returns a clear "AI gateway unavailable" error without throwing', async () => {
    const parser = new NoOpItineraryParser();
    const outcome = await parser.parse();

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.error).toContain('AI_GATEWAY_API_KEY');
      expect(outcome.error).toContain('Vercel');
    }
  });
});
