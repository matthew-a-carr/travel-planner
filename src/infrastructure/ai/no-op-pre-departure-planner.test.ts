import { describe, expect, it } from 'vitest';
import { NoOpPreDeparturePlannerService } from './no-op-pre-departure-planner';

describe('NoOpPreDeparturePlannerService', () => {
  it('returns an empty plan so the panel hides itself', async () => {
    const service = new NoOpPreDeparturePlannerService();
    const outcome = await service.plan();

    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.result.items).toEqual([]);
      expect(outcome.result.transportLegs).toEqual([]);
    }
  });
});
