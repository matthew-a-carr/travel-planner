import type { ComfortLevel } from '../trip/types';

export type FindingSeverity = 'info' | 'warning' | 'danger';

export type FindingKind =
  | 'gap'
  | 'overlap'
  | 'budget-low'
  | 'budget-high'
  | 'seasonality'
  | 'transport-missing'
  | 'visa-required'
  | 'event-clash'
  | 'peak-pricing';

export type TimelineFinding = {
  readonly stopId: string | null;
  readonly severity: FindingSeverity;
  readonly kind: FindingKind;
  readonly message: string;
  readonly suggestion: string | null;
};

export type ParsedItineraryRow = {
  readonly country: string;
  readonly city: string | null;
  readonly startDate: Date | null;
  readonly endDate: Date | null;
  readonly comfortLevel: ComfortLevel | null;
  /**
   * Filled by the use case via country-reference suggestion when the LLM did
   * not return one. Null when no reference is available or dates are missing.
   */
  readonly suggestedBudgetPence: number | null;
  readonly confidence: 'high' | 'medium' | 'low';
  readonly notes: string | null;
};

export type ParsedItineraryResult = {
  readonly rows: readonly ParsedItineraryRow[];
  readonly unresolved: readonly string[];
};
