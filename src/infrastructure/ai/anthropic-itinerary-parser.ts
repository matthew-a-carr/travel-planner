import type { LanguageModel } from 'ai';
import { generateObject } from 'ai';
import { z } from 'zod';
import type {
  ItineraryParser,
  ParseItineraryInput,
  ParseItineraryOutcome,
} from '@/application/ports/itinerary-parser';
import type { ParsedItineraryResult, ParsedItineraryRow } from '@/domain/timeline/types';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');

const parsedItinerarySchema = z.object({
  rows: z.array(
    z.object({
      country: z.string().describe('Canonical country name from the supplied list'),
      city: z.string().nullable(),
      startDate: isoDate.nullable(),
      endDate: isoDate.nullable(),
      comfortLevel: z.enum(['budget', 'mid', 'luxury']).nullable(),
      confidence: z.enum(['high', 'medium', 'low']),
      notes: z.string().nullable(),
    }),
  ),
  unresolved: z.array(z.string()),
});

const SYSTEM_PROMPT = `You are an itinerary extraction assistant for a travel-planning app.
Given a free-form text fragment (booking confirmations, chat messages, planning notes),
extract one row per intended destination stop.

Rules:
- Use the supplied list of canonical country names. Map fuzzy mentions ("Veitnam", "Vietnamese coast") to the exact canonical form.
- Only emit a row when you have at least a country.
- If dates are relative ("3 weeks Vietnam from Aug 1"), resolve them to YYYY-MM-DD using the supplied reference date for the current year, picking the next future occurrence.
- Use null for unknown fields. Do not invent cities or dates.
- comfortLevel is rarely stated; emit null unless the text obviously implies budget/mid/luxury.
- confidence: 'high' when dates and country are explicit; 'medium' when one is inferred; 'low' when most of the row is inferred.
- Place anything that doesn't map to a row into "unresolved" (one entry per fragment).`;

export class AnthropicItineraryParser implements ItineraryParser {
  constructor(private readonly model: LanguageModel) {}

  async parse(input: ParseItineraryInput): Promise<ParseItineraryOutcome> {
    const userPrompt = [
      `Reference date: ${input.referenceDate}`,
      `Canonical countries: ${input.knownCountries.join(', ')}`,
      '',
      'Text:',
      input.text,
    ].join('\n');

    try {
      const { object } = await generateObject({
        model: this.model,
        schema: parsedItinerarySchema,
        system: SYSTEM_PROMPT,
        prompt: userPrompt,
      });

      const result: ParsedItineraryResult = {
        rows: object.rows.map(
          (r): ParsedItineraryRow => ({
            country: r.country,
            city: r.city,
            startDate: r.startDate ? new Date(`${r.startDate}T00:00:00Z`) : null,
            endDate: r.endDate ? new Date(`${r.endDate}T00:00:00Z`) : null,
            comfortLevel: r.comfortLevel,
            suggestedBudgetPence: null,
            confidence: r.confidence,
            notes: r.notes,
          }),
        ),
        unresolved: object.unresolved,
      };

      return { ok: true, result };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown parser error';
      return { ok: false, error: `Itinerary parser failed: ${message}` };
    }
  }
}
