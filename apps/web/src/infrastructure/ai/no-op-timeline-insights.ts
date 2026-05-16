import type {
  AnalyseTimelineOutcome,
  TimelineInsightsService,
} from '@/application/ports/timeline-insights-service';

/**
 * Fallback insights service used when AI_GATEWAY_API_KEY is unset.
 * Returns no AI findings — the use case still emits its deterministic findings.
 */
export class NoOpTimelineInsights implements TimelineInsightsService {
  async analyse(): Promise<AnalyseTimelineOutcome> {
    return { ok: true, findings: [] };
  }
}
