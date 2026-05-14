import { describe, expect, it } from 'vitest';
import { NoOpTripNarrativeService } from './no-op-trip-narrative';

describe('NoOpTripNarrativeService', () => {
  it('returns an empty narrative so the panel is hidden by the UI', async () => {
    const service = new NoOpTripNarrativeService();
    const outcome = await service.summarise();

    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.result.narrative).toBe('');
      expect(outcome.result.bullets).toEqual([]);
    }
  });
});
