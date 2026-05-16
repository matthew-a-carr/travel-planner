import { describe, expect, it } from 'vitest';
import { NoOpTimelineInsights } from './no-op-timeline-insights';

describe('NoOpTimelineInsights', () => {
  it('returns ok with no findings so the use case still emits deterministic findings', async () => {
    const insights = new NoOpTimelineInsights();
    const outcome = await insights.analyse();

    expect(outcome.ok).toBe(true);
    if (outcome.ok) expect(outcome.findings).toEqual([]);
  });
});
