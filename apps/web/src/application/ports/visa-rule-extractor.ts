import type { Alpha3, EntryType, VisaCategory, VisaPurpose } from '@/domain/visa/types';

/**
 * One visa rule as extracted by the AI job, before the script stamps on the
 * identity/temporal/provenance fields (nationality, destination, zoneCode,
 * validFrom/validTo, source). A single (nationality → destination) may yield
 * more than one (e.g. a tourist rule + a working-holiday rule).
 */
export type ExtractedVisaRule = {
  readonly purpose: VisaPurpose;
  readonly workRights: boolean;
  readonly minAgeYears: number | null;
  readonly maxAgeYears: number | null;
  readonly eligibilityNotes: string | null;
  readonly category: VisaCategory;
  readonly maxStayDays: number | null;
  readonly visaValidityDays: number | null;
  readonly entryType: EntryType;
  readonly minDaysOutBeforeReturn: number | null;
  readonly rollingWindow: { readonly allowanceDays: number; readonly windowDays: number } | null;
  readonly otherRequirements: readonly string[];
  readonly sourceNote: string;
};

export type ExtractVisaRulesInput = {
  readonly nationality: Alpha3; // passport, e.g. "GBR"
  readonly destination: Alpha3; // destination country, e.g. "VNM"
  readonly destinationName: string; // canonical display name for the prompt
};

export type ExtractVisaRulesOutcome =
  | { readonly ok: true; readonly rules: readonly ExtractedVisaRule[] }
  | { readonly ok: false; readonly error: string };

/**
 * Port for the **one-off, offline** visa-rule extraction job (SPEC-015 / ADR
 * 061). Implemented by an AI adapter and used **only** by `scripts/fetch-visa-rules.ts`.
 * The runtime evaluator never calls this — extracted rules are frozen into a
 * committed, human-reviewed seed file.
 */
export interface VisaRuleExtractor {
  extract(input: ExtractVisaRulesInput): Promise<ExtractVisaRulesOutcome>;
}
