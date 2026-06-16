import { generateObject } from 'ai';
import { z } from 'zod';
import type {
  ExtractedVisaRule,
  ExtractVisaRulesInput,
  ExtractVisaRulesOutcome,
  VisaRuleExtractor,
} from '@/application/ports/visa-rule-extractor';

/** Zod schema validating the model's structured output (shape, not facts). */
export const visaRuleExtractionSchema = z.object({
  rules: z
    .array(
      z.object({
        purpose: z
          .enum(['tourism', 'business', 'working-holiday', 'transit', 'study'])
          .describe('The visa purpose this rule covers'),
        workRights: z.boolean().describe('Whether the visa permits paid work'),
        minAgeYears: z.number().int().nonnegative().nullable(),
        maxAgeYears: z.number().int().nonnegative().nullable(),
        eligibilityNotes: z.string().max(300).nullable(),
        category: z.enum([
          'visa-free',
          'visa-on-arrival',
          'e-visa',
          'eta',
          'visa-required',
          'admission-refused',
        ]),
        maxStayDays: z.number().int().positive().nullable(),
        visaValidityDays: z.number().int().positive().nullable(),
        entryType: z.enum(['single', 'multiple']),
        minDaysOutBeforeReturn: z.number().int().nonnegative().nullable(),
        rollingWindow: z
          .object({
            allowanceDays: z.number().int().positive(),
            windowDays: z.number().int().positive(),
          })
          .nullable(),
        otherRequirements: z.array(z.string().min(3).max(200)).max(8),
        sourceNote: z
          .string()
          .min(4)
          .max(300)
          .describe('Citation for this rule (e.g. gov.uk page)'),
      }),
    )
    .max(6),
});

const SYSTEM_PROMPT = `You are a visa-policy research assistant for a travel-planning app.
Given a traveller's passport nationality and a destination country, emit the entry rules
that apply to ordinary leisure/short-stay travel, plus any well-established longer-stay
route (e.g. a Working Holiday visa) if one clearly exists.

Rules:
- Emit ONE entry per distinct visa/purpose. A country often has just one (short-stay); some
  have two (e.g. a tourist rule + a working-holiday rule).
- Only emit policy you are confident is well-established and current. If unsure, prefer the
  safer interpretation and say so in sourceNote. Do NOT invent specifics.
- maxStayDays is the longest single permitted stay; rollingWindow models shared allowances
  like Schengen's "90 days in any 180" (set it only when such a rule genuinely applies).
- entryType: 'multiple' if the holder may leave and re-enter on the same authorisation.
- Age-restricted routes (working holiday) set minAgeYears/maxAgeYears and workRights=true.
- sourceNote MUST cite where the rule comes from (e.g. the relevant gov.uk travel-advice page).`;

/**
 * AI adapter for the one-off visa extraction job (SPEC-015 / ADR 061). Used
 * ONLY by `scripts/fetch-visa-rules.ts` — never on the runtime request path.
 * Model-agnostic; the gateway dispatches on the model-id string (ADR 040).
 */
export class GatewayVisaRuleExtractor implements VisaRuleExtractor {
  constructor(private readonly modelId: string) {}

  async extract(input: ExtractVisaRulesInput): Promise<ExtractVisaRulesOutcome> {
    const prompt = [
      `Passport nationality (ISO alpha-3): ${input.nationality}`,
      `Destination country: ${input.destinationName} (${input.destination})`,
    ].join('\n');

    try {
      const { object } = await generateObject({
        model: this.modelId,
        schema: visaRuleExtractionSchema,
        system: SYSTEM_PROMPT,
        prompt,
      });

      const rules: ExtractedVisaRule[] = object.rules.map((r) => ({
        purpose: r.purpose,
        workRights: r.workRights,
        minAgeYears: r.minAgeYears,
        maxAgeYears: r.maxAgeYears,
        eligibilityNotes: r.eligibilityNotes,
        category: r.category,
        maxStayDays: r.maxStayDays,
        visaValidityDays: r.visaValidityDays,
        entryType: r.entryType,
        minDaysOutBeforeReturn: r.minDaysOutBeforeReturn,
        rollingWindow: r.rollingWindow,
        otherRequirements: r.otherRequirements,
        sourceNote: r.sourceNote,
      }));

      return { ok: true, rules };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown extractor error';
      return { ok: false, error: `Visa rule extractor failed: ${message}` };
    }
  }
}
