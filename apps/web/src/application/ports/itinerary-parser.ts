import type { ParsedItineraryResult } from '@/domain/timeline/types';

export type ParseItineraryInput = {
  /** Raw user-pasted text (booking confirmation, free-form notes, etc.) */
  readonly text: string;
  /** ISO YYYY-MM-DD reference date — used by the parser to disambiguate
   *  relative phrases like "next August". */
  readonly referenceDate: string;
  /** Canonical country names available to the trip — passed through to the
   *  parser so it can map fuzzy mentions ("Veitnam") to the canonical form
   *  used by the country-reference data. */
  readonly knownCountries: readonly string[];
};

export type ParseItineraryOutcome =
  | { readonly ok: true; readonly result: ParsedItineraryResult }
  | { readonly ok: false; readonly error: string };

export interface ItineraryParser {
  parse(input: ParseItineraryInput): Promise<ParseItineraryOutcome>;
}
