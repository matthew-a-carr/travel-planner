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
      kind: z.enum([
        'seasonality',
        'transport-missing',
        'visa-required',
        'event-clash',
        'peak-pricing',
      ]),
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
- 'visa-required': the destination's country typically requires a short-stay tourist visa for the traveller's passport nationality (given below), and the trip has no fixed-cost row of category 'visas' for it. Be conservative — only emit when the visa requirement is well-established for that nationality. Do *not* emit for visa-free or visa-on-arrival destinations. The suggestion must include the phrase "verify with the embassy" because policies change.
- 'event-clash': the destination's date range overlaps a major festival, public-holiday cluster, or sporting event well-known to spike prices or close attractions (e.g. Songkran in Thailand, Tet in Vietnam, Diwali in India, Carnival in Rio, European school summer holidays). Skip if unsure.
- 'peak-pricing': the destination's date range overlaps the well-known peak tourist season for the country/region (e.g. July–August in Mediterranean Europe, Dec–Feb in the Caribbean, mid-Jul to mid-Aug in Japan around Obon) and the comfort level is not already 'luxury'. Only emit when it materially affects accommodation or transport cost.

Rules:
- Use stopId from the destinations input. Never invent ids.
- Be conservative. Skip a finding rather than fabricate one. When in doubt, omit.
- One finding per (stopId, kind). At most 8 findings total.
- 'message' must be a single concrete sentence. 'suggestion' must be a single actionable next step or null.
- For 'visa-required', the message must mention the visa name/type and the suggestion must direct the user to verify with the embassy.`;

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
  constructor(private readonly modelId: string) {}

  async analyse(input: AnalyseTimelineInput): Promise<AnalyseTimelineOutcome> {
    const datedDestinations = input.destinations.filter((d) => d.startDate && d.endDate);
    if (datedDestinations.length === 0) {
      return { ok: true, findings: [] };
    }

    const nationalities = input.nationalities?.filter((n) => n.trim() !== '') ?? [];
    const passportLine =
      nationalities.length > 0 ? nationalities.join(' or ') : 'the United Kingdom';

    try {
      const { object } = await generateObject({
        model: this.modelId,
        schema: insightsSchema,
        system: SYSTEM_PROMPT,
        prompt: `Traveller passport nationality: ${passportLine}\nTrip:\n${JSON.stringify(toJson(input), null, 2)}`,
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
