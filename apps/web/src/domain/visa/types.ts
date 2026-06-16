// ─── Visa requirements: domain types ────────────────────────────────────────
//
// Pure types for the visa-requirements evaluator. Zero external imports
// (per src/domain/CLAUDE.md) — only `Result` from the trip types.
//
// Country identity is ISO 3166-1 alpha-3 (a stable join key, unlike the
// free-text `Destination.country`). Date-only values are ISO `YYYY-MM-DD`
// strings inside rules; `Date` only appears where it comes from `Destination`.

import type { Result } from '../trip/types';

export type { Result };

/** ISO 3166-1 alpha-3 country code, e.g. "GBR". */
export type Alpha3 = string;

// ─── Traveller ──────────────────────────────────────────────────────────────

/** A single passport the traveller holds. First pass: only "GBR" is seeded. */
export type Passport = {
  readonly nationality: Alpha3; // issuing country, e.g. "GBR"
  readonly label: string | null; // optional display label ("UK passport")
};

/**
 * The traveller's profile for visa assessment. `passports` is non-empty by
 * construction; `dateOfBirth` (ISO date-only, nullable) drives age-based
 * eligibility. Shape kept open for future attributes (residency, prior visas).
 */
export type TravellerProfile = {
  readonly passports: readonly Passport[];
  readonly dateOfBirth: string | null; // ISO "YYYY-MM-DD"
};

// ─── Visa rule reference (seeded, temporal) ─────────────────────────────────

export type VisaPurpose = 'tourism' | 'business' | 'working-holiday' | 'transit' | 'study';

/** Purposes considered for default ("short-stay") auto-selection. */
export const SHORT_STAY_PURPOSES: readonly VisaPurpose[] = ['tourism', 'business', 'transit'];

export type VisaCategory =
  | 'visa-free'
  | 'visa-on-arrival'
  | 'e-visa'
  | 'eta' // electronic travel authorisation (e.g. ESTA / ETIAS)
  | 'visa-required'
  | 'admission-refused';

export type EntryType = 'single' | 'multiple';

/**
 * Conditions a traveller must satisfy to be eligible for a rule. Age bounds are
 * modelled concretely now; the shape is kept open. `null` bound = no constraint.
 */
export type Eligibility = {
  readonly minAgeYears: number | null;
  readonly maxAgeYears: number | null;
  readonly notes: string | null;
};

/** A rolling-window allowance, e.g. "90 days in any 180". */
export type RollingWindow = {
  readonly allowanceDays: number; // e.g. 90
  readonly windowDays: number; // e.g. 180
};

/**
 * One visa rule for (nationality → destination), valid over a date window.
 * The unit of seeded reference data. `zoneCode`, when set, means the allowance
 * is shared across every destination mapped to the same zone (e.g. Schengen).
 */
export type VisaRule = {
  readonly id: string;
  readonly nationality: Alpha3; // traveller passport, e.g. "GBR"
  readonly destination: Alpha3; // destination country, e.g. "VNM"
  readonly zoneCode: string | null; // e.g. "SCHENGEN", else null

  readonly purpose: VisaPurpose;
  readonly workRights: boolean;
  readonly eligibility: Eligibility;

  readonly category: VisaCategory;
  readonly maxStayDays: number | null; // max single permitted stay; null = unlimited/N-A
  readonly visaValidityDays: number | null; // how long the visa itself is valid
  readonly entryType: EntryType;
  readonly minDaysOutBeforeReturn: number | null; // cooling-off; null = none
  readonly rollingWindow: RollingWindow | null; // e.g. 90/180; null = none

  readonly otherRequirements: readonly string[]; // free-text caveats

  readonly validFrom: string; // ISO date-only "2024-01-01"
  readonly validTo: string | null; // null = open-ended

  readonly source: 'ai-extracted' | 'manual';
  readonly sourceNote: string | null;
};

// ─── Stay accounting ────────────────────────────────────────────────────────

/** A merged-contiguous presence interval (date-only ISO). */
export type StaySegment = {
  readonly start: string;
  readonly end: string;
  readonly days: number;
};

/**
 * Aggregated presence in one destination grouping (country, or zone) across all
 * its cities. `totalDays` sums every destination date-range; `entries` counts
 * distinct (gap-separated) segments.
 */
export type CountryStay = {
  readonly destination: Alpha3; // the grouping key: country alpha-3, or the zone code
  readonly zoneCode: string | null;
  readonly countries: readonly Alpha3[]; // distinct destination countries feeding this group
  readonly totalDays: number;
  readonly entries: number;
  readonly firstArrival: string | null; // ISO date-only, null if no dated destinations
  readonly lastDeparture: string | null;
  readonly segments: readonly StaySegment[];
};

// ─── Coverage evaluation ────────────────────────────────────────────────────

export type VisaViolationKind =
  | 'max-stay-exceeded'
  | 'single-entry-multiple-entries'
  | 'cooling-off-violated'
  | 'rolling-window-exceeded'
  | 'visa-required'
  | 'admission-refused';

export type VisaViolation = {
  readonly kind: VisaViolationKind;
  readonly message: string;
  readonly limit: number | null; // the breached threshold (days/entries)
  readonly actual: number | null; // the observed value
};

export type CoverageStatus = 'ok' | 'action-needed' | 'violation' | 'unknown';

export type CountryCoverage = {
  readonly destination: Alpha3;
  readonly zoneCode: string | null;
  readonly appliedNationality: Alpha3 | null; // which passport produced this (null if unknown)
  readonly status: CoverageStatus;
  readonly appliedRuleId: string | null;
  readonly category: VisaCategory | null;
  readonly purpose: VisaPurpose | null;
  readonly workRights: boolean;
  readonly stay: CountryStay;
  readonly violations: readonly VisaViolation[];
  readonly otherRequirements: readonly string[];
  readonly alternativeRuleIds: readonly string[]; // other eligible rules not auto-selected
};

export type VisaAssessment = {
  readonly coverages: readonly CountryCoverage[];
  readonly unknownCountries: readonly Alpha3[];
};
