import type { LanguageModel } from 'ai';
import { generateObject } from 'ai';
import { z } from 'zod';
import type {
  AnalyseTimelineInput,
  AnalyseTimelineOutcome,
  TimelineInsightsService,
} from '@/application/ports/timeline-insights-service';
import type { TimelineFinding } from '@/domain/timeline/types';

const insightsSchema = z.object({
  findings: z.array(
    z.object({
      stopId: z.string().nullable(),
      severity: z.enum(['info', 'warning', 'danger']),
      kind: z.enum(['seasonality', 'transport-missing']),
      message: z.string().min(4).max(280),
      suggestion: z.string().nullable(),
    }),
  ),
});

const SYSTEM_PROMPT = `You are a travel-timeline reviewer. You receive a JSON description of a trip's
destinations (country, city, date range, comfort level, estimated budget) and fixed costs (label,
date, amount, category).

Return *only* findings of these kinds — nothing else:
- 'seasonality': a destination falls in a clearly unfavourable season (heavy wet season, off-peak shutdown, extreme heat/cold) given its country and dates.
- 'transport-missing': a long inter-country leg between consecutive dated destinations has no fixed-cost row of category 'transport' anywhere on or close to the transition date.

Rules:
- Use stopId from the destinations input. Never invent ids.
- Be conservative. Skip a finding rather than fabricate one.
- One finding per (stopId, kind). At most 8 findings total.
- 'message' must be a single concrete sentence. 'suggestion' must be a single actionable next step or null.`;

type TimelineInputJson = {
  destinations: {
    id: string;
    country: string;
    city: string | null;
    startDate: string | null;
    endDate: string | null;
    comfortLevel: string;
    estimatedBudgetPence: number;
  }[];
  fixedCosts: {
    id: string;
    label: string;
    category: string;
    date: string;
    amountPence: number;
  }[];
};

function toJson(input: AnalyseTimelineInput): TimelineInputJson {
  return {
    destinations: input.destinations.map((d) => ({
      id: d.id,
      country: d.country,
      city: d.city,
      startDate: d.startDate ? d.startDate.toISOString().slice(0, 10) : null,
      endDate: d.endDate ? d.endDate.toISOString().slice(0, 10) : null,
      comfortLevel: d.comfortLevel,
      estimatedBudgetPence: d.estimatedBudget.amountPence,
    })),
    fixedCosts: input.fixedCosts.map((f) => ({
      id: f.id,
      label: f.label,
      category: f.category,
      date: f.date.toISOString().slice(0, 10),
      amountPence: f.amount.amountPence,
    })),
  };
}

export class AnthropicTimelineInsights implements TimelineInsightsService {
  constructor(private readonly model: LanguageModel) {}

  async analyse(input: AnalyseTimelineInput): Promise<AnalyseTimelineOutcome> {
    const datedDestinations = input.destinations.filter((d) => d.startDate && d.endDate);
    if (datedDestinations.length === 0) {
      return { ok: true, findings: [] };
    }

    try {
      const { object } = await generateObject({
        model: this.model,
        schema: insightsSchema,
        system: SYSTEM_PROMPT,
        prompt: `Trip:\n${JSON.stringify(toJson(input), null, 2)}`,
      });
      const findings: TimelineFinding[] = object.findings.map((f) => ({
        stopId: f.stopId,
        severity: f.severity,
        kind: f.kind,
        message: f.message,
        suggestion: f.suggestion,
      }));
      return { ok: true, findings };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown insights error';
      return { ok: false, error: `Timeline insights failed: ${message}` };
    }
  }
}
