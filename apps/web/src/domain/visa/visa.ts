// ─── Visa requirements: pure evaluator ──────────────────────────────────────
//
// Deterministic, synchronous, side-effect-free (per src/domain/CLAUDE.md). Given
// a trip's destinations + dates, the traveller's profile, and a frozen set of
// visa rules, produce a VisaAssessment. No I/O, no AI, no exceptions.

import type { Destination, Result } from '../trip/types';
import { err, ok } from '../trip/types';
import {
  type Alpha3,
  type CountryCoverage,
  type CountryStay,
  type CoverageStatus,
  SHORT_STAY_PURPOSES,
  type StaySegment,
  type TravellerProfile,
  type VisaAssessment,
  type VisaCategory,
  type VisaPurpose,
  type VisaRule,
  type VisaViolation,
} from './types';

const MS_PER_DAY = 1000 * 60 * 60 * 24;

// ─── Date helpers (date-only ISO arithmetic) ────────────────────────────────

/** Days since the Unix epoch for an ISO `YYYY-MM-DD` date (UTC). */
export function isoToDays(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / MS_PER_DAY);
}

/** Inverse of `isoToDays`. */
export function daysToIso(days: number): string {
  return new Date(days * MS_PER_DAY).toISOString().slice(0, 10);
}

/** A `Date` (date-only conceptually) → ISO `YYYY-MM-DD`. */
function dateToIso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Full years elapsed between two ISO dates (age at `atIso` given `dobIso`). */
export function ageAt(dobIso: string, atIso: string): number {
  const [by, bm, bd] = dobIso.split('-').map(Number);
  const [ay, am, ad] = atIso.split('-').map(Number);
  let age = ay - by;
  if (am < bm || (am === bm && ad < bd)) age -= 1;
  return age;
}

// ─── 1. Aggregate presence per country / zone ───────────────────────────────

type RawInterval = {
  readonly startDays: number;
  readonly endDays: number;
  readonly country: Alpha3;
};

function mergeSegments(intervals: readonly RawInterval[]): {
  readonly segments: StaySegment[];
  readonly totalDays: number;
} {
  const sorted = [...intervals].sort((a, b) => a.startDays - b.startDays);
  const merged: { start: number; end: number }[] = [];
  for (const iv of sorted) {
    const last = merged[merged.length - 1];
    // Contiguous (touching) or overlapping intervals merge into one segment.
    if (last && iv.startDays <= last.end) {
      if (iv.endDays > last.end) last.end = iv.endDays;
    } else {
      merged.push({ start: iv.startDays, end: iv.endDays });
    }
  }
  const segments = merged.map((m) => ({
    start: daysToIso(m.start),
    end: daysToIso(m.end),
    days: m.end - m.start,
  }));
  const totalDays = merged.reduce((sum, m) => sum + (m.end - m.start), 0);
  return { segments, totalDays };
}

/**
 * Group every dated destination by `zoneOf(alpha3) ?? alpha3` and aggregate
 * presence. Two cities in one country (or several countries in one zone) sum
 * into one CountryStay; gap-separated visits count as multiple `entries`.
 * Undated or unresolvable destinations contribute nothing.
 */
export function aggregateCountryStays(
  destinations: readonly Destination[],
  toAlpha3: (countryName: string) => Alpha3 | null,
  zoneOf: (alpha3: Alpha3) => string | null,
): Result<readonly CountryStay[]> {
  const groups = new Map<
    string,
    { zoneCode: string | null; countries: Set<Alpha3>; intervals: RawInterval[] }
  >();

  for (const dest of destinations) {
    if (dest.startDate === null || dest.endDate === null) continue;
    const alpha3 = toAlpha3(dest.country);
    if (alpha3 === null) continue;
    const startDays = isoToDays(dateToIso(dest.startDate));
    const endDays = isoToDays(dateToIso(dest.endDate));
    if (endDays <= startDays) continue;

    const zoneCode = zoneOf(alpha3);
    const key = zoneCode ?? alpha3;
    let group = groups.get(key);
    if (!group) {
      group = { zoneCode, countries: new Set(), intervals: [] };
      groups.set(key, group);
    }
    group.countries.add(alpha3);
    group.intervals.push({ startDays, endDays, country: alpha3 });
  }

  const stays: CountryStay[] = [];
  for (const [key, group] of groups) {
    const { segments, totalDays } = mergeSegments(group.intervals);
    stays.push({
      destination: key,
      zoneCode: group.zoneCode,
      countries: [...group.countries].sort(),
      totalDays,
      entries: segments.length,
      firstArrival: segments.length ? segments[0].start : null,
      lastDeparture: segments.length ? segments[segments.length - 1].end : null,
      segments,
    });
  }
  // Deterministic ordering by group key.
  stays.sort((a, b) =>
    a.destination < b.destination ? -1 : a.destination > b.destination ? 1 : 0,
  );
  return ok(stays);
}

// ─── 2. Eligibility + temporal rule selection ───────────────────────────────

/**
 * Drop rules the traveller isn't eligible for (age bounds vs DOB at travel
 * start). A null DOB leaves age-bounded rules in place (we can't disqualify
 * without a birth date) — the caller may surface that as eligibility-unknown.
 */
export function filterEligibleRules(
  candidateRules: readonly VisaRule[],
  profile: TravellerProfile,
  travel: { readonly start: string; readonly end: string },
): readonly VisaRule[] {
  const age = profile.dateOfBirth === null ? null : ageAt(profile.dateOfBirth, travel.start);
  return candidateRules.filter((rule) => {
    const { minAgeYears, maxAgeYears } = rule.eligibility;
    if (age === null) return true; // unknown DOB → keep, can't disqualify
    if (minAgeYears !== null && age < minAgeYears) return false;
    if (maxAgeYears !== null && age > maxAgeYears) return false;
    return true;
  });
}

function temporallyApplicable(
  rules: readonly VisaRule[],
  travel: { readonly start: string; readonly end: string },
): readonly VisaRule[] {
  return rules.filter(
    (rule) => rule.validFrom <= travel.end && (rule.validTo ?? '9999-12-31') >= travel.start,
  );
}

/** Newest `validFrom` wins; ties broken by `id` for determinism. */
function newestWins(rules: readonly VisaRule[]): VisaRule | null {
  if (rules.length === 0) return null;
  return [...rules].sort((a, b) => {
    if (a.validFrom !== b.validFrom) return a.validFrom < b.validFrom ? 1 : -1;
    return a.id < b.id ? 1 : -1;
  })[0];
}

/**
 * Select the rule to auto-apply: among temporally-applicable rules, prefer the
 * given purposes (default short-stay). If none match the preference but other
 * applicable rules exist, fall back to those so a country with only (say) a
 * working-holiday rule still gets coverage.
 */
export function selectApplicableRule(
  candidateRules: readonly VisaRule[],
  travel: { readonly start: string; readonly end: string },
  preferPurposes: readonly VisaPurpose[] = SHORT_STAY_PURPOSES,
): Result<VisaRule | null> {
  const applicable = temporallyApplicable(candidateRules, travel);
  const preferred = applicable.filter((r) => preferPurposes.includes(r.purpose));
  const pool = preferred.length > 0 ? preferred : applicable;
  return ok(newestWins(pool));
}

// ─── 3. Coverage evaluation ─────────────────────────────────────────────────

export type CoverageEvaluation = {
  readonly status: CoverageStatus;
  readonly category: VisaCategory | null;
  readonly purpose: VisaPurpose | null;
  readonly workRights: boolean;
  readonly appliedRuleId: string | null;
  readonly violations: readonly VisaViolation[];
  readonly otherRequirements: readonly string[];
};

/**
 * Rolling-window check (the canonical Schengen 90/180). A segment `[start,end)`
 * marks calendar days `start … end-1` as present. Slides a `windowDays` window
 * ending on each present day and flags if presence ever exceeds `allowanceDays`.
 */
export function evaluateRollingWindow(
  segments: readonly StaySegment[],
  window: { readonly allowanceDays: number; readonly windowDays: number },
): { readonly exceeded: boolean; readonly peakDays: number; readonly peakOn: string | null } {
  const presentDays: number[] = [];
  for (const seg of segments) {
    for (let d = isoToDays(seg.start); d < isoToDays(seg.end); d++) presentDays.push(d);
  }
  if (presentDays.length === 0) return { exceeded: false, peakDays: 0, peakOn: null };
  const presentSet = new Set(presentDays);
  let peakDays = 0;
  let peakOn: string | null = null;
  for (const end of presentDays) {
    let count = 0;
    for (let d = end - window.windowDays + 1; d <= end; d++) {
      if (presentSet.has(d)) count++;
    }
    if (count > peakDays) {
      peakDays = count;
      peakOn = daysToIso(end);
    }
  }
  return { exceeded: peakDays > window.allowanceDays, peakDays, peakOn };
}

/** Evaluate one country/zone stay against its selected rule (pure). */
export function evaluateCoverage(stay: CountryStay, rule: VisaRule | null): CoverageEvaluation {
  if (rule === null) {
    return {
      status: 'unknown',
      category: null,
      purpose: null,
      workRights: false,
      appliedRuleId: null,
      violations: [],
      otherRequirements: [],
    };
  }

  const violations: VisaViolation[] = [];

  // Category gate.
  if (rule.category === 'admission-refused') {
    violations.push({
      kind: 'admission-refused',
      message: 'Entry is not permitted on this passport.',
      limit: null,
      actual: null,
    });
  } else if (rule.category === 'visa-required') {
    violations.push({
      kind: 'visa-required',
      message: 'A visa must be obtained in advance for this trip.',
      limit: null,
      actual: null,
    });
  }

  // Max stay (per visit / per segment).
  if (rule.maxStayDays !== null) {
    for (const seg of stay.segments) {
      if (seg.days > rule.maxStayDays) {
        violations.push({
          kind: 'max-stay-exceeded',
          message: `A single stay of ${seg.days} days exceeds the ${rule.maxStayDays}-day limit.`,
          limit: rule.maxStayDays,
          actual: seg.days,
        });
      }
    }
  }

  // Single-entry vs multiple entries.
  if (rule.entryType === 'single' && stay.entries > 1) {
    violations.push({
      kind: 'single-entry-multiple-entries',
      message: `This itinerary enters ${stay.entries} times but the visa is single-entry.`,
      limit: 1,
      actual: stay.entries,
    });
  }

  // Cooling-off between visits.
  if (rule.minDaysOutBeforeReturn !== null) {
    for (let i = 0; i < stay.segments.length - 1; i++) {
      const gap = isoToDays(stay.segments[i + 1].start) - isoToDays(stay.segments[i].end);
      if (gap < rule.minDaysOutBeforeReturn) {
        violations.push({
          kind: 'cooling-off-violated',
          message: `Only ${gap} days out before returning; ${rule.minDaysOutBeforeReturn} are required.`,
          limit: rule.minDaysOutBeforeReturn,
          actual: gap,
        });
      }
    }
  }

  // Rolling window (e.g. Schengen 90/180).
  if (rule.rollingWindow !== null) {
    const rw = evaluateRollingWindow(stay.segments, rule.rollingWindow);
    if (rw.exceeded) {
      violations.push({
        kind: 'rolling-window-exceeded',
        message: `${rw.peakDays} days in a ${rule.rollingWindow.windowDays}-day window exceeds the ${rule.rollingWindow.allowanceDays}-day allowance.`,
        limit: rule.rollingWindow.allowanceDays,
        actual: rw.peakDays,
      });
    }
  }

  const hardKinds: ReadonlySet<string> = new Set([
    'admission-refused',
    'max-stay-exceeded',
    'single-entry-multiple-entries',
    'cooling-off-violated',
    'rolling-window-exceeded',
  ]);
  const hasHard = violations.some((v) => hardKinds.has(v.kind));
  const hasActionNeeded = violations.some((v) => v.kind === 'visa-required');
  const status: CoverageStatus = hasHard ? 'violation' : hasActionNeeded ? 'action-needed' : 'ok';

  return {
    status,
    category: rule.category,
    purpose: rule.purpose,
    workRights: rule.workRights,
    appliedRuleId: rule.id,
    violations,
    otherRequirements: rule.otherRequirements,
  };
}

// ─── Multi-passport "most favourable" pick ──────────────────────────────────

const STATUS_RANK: Record<CoverageStatus, number> = {
  ok: 0,
  'action-needed': 1,
  violation: 2,
  unknown: 3,
};

const CATEGORY_RANK: Record<VisaCategory, number> = {
  'visa-free': 0,
  'visa-on-arrival': 1,
  eta: 2,
  'e-visa': 3,
  'visa-required': 4,
  'admission-refused': 5,
};

/**
 * Choose the most favourable coverage across a traveller's passports for one
 * country: best status, then loosest category, then fewest violations, then a
 * stable nationality tie-break.
 */
export function pickBestCoverage(coverages: readonly CountryCoverage[]): CountryCoverage {
  return [...coverages].sort((a, b) => {
    const s = STATUS_RANK[a.status] - STATUS_RANK[b.status];
    if (s !== 0) return s;
    const ca = a.category === null ? 99 : CATEGORY_RANK[a.category];
    const cb = b.category === null ? 99 : CATEGORY_RANK[b.category];
    if (ca !== cb) return ca - cb;
    if (a.violations.length !== b.violations.length)
      return a.violations.length - b.violations.length;
    return (a.appliedNationality ?? '') < (b.appliedNationality ?? '') ? -1 : 1;
  })[0];
}

// ─── 4. Top-level orchestration ─────────────────────────────────────────────

/**
 * Assess a trip's visa coverage across the traveller's passports. Pure: takes
 * pre-fetched rules + resolvers, returns a VisaAssessment.
 */
export function assessVisas(
  profile: TravellerProfile,
  destinations: readonly Destination[],
  rules: readonly VisaRule[],
  toAlpha3: (countryName: string) => Alpha3 | null,
  zoneOf: (alpha3: Alpha3) => string | null,
  travel: { readonly start: string; readonly end: string },
  preferPurposes: readonly VisaPurpose[] = SHORT_STAY_PURPOSES,
): Result<VisaAssessment> {
  const staysResult = aggregateCountryStays(destinations, toAlpha3, zoneOf);
  if (!staysResult.ok) return err(staysResult.error);

  const coverages: CountryCoverage[] = [];
  const unknownCountries: Alpha3[] = [];

  for (const stay of staysResult.value) {
    const candidates: CountryCoverage[] = [];

    for (const passport of profile.passports) {
      const candidateRules = rules.filter(
        (r) => r.nationality === passport.nationality && stay.countries.includes(r.destination),
      );
      const eligible = filterEligibleRules(candidateRules, profile, travel);
      const selectResult = selectApplicableRule(eligible, travel, preferPurposes);
      if (!selectResult.ok) return err(selectResult.error);
      const selected = selectResult.value;
      const evaluation = evaluateCoverage(stay, selected);

      const applicableEligibleIds = temporallyApplicable(eligible, travel).map((r) => r.id);
      const alternativeRuleIds = applicableEligibleIds.filter(
        (id) => id !== evaluation.appliedRuleId,
      );

      candidates.push({
        destination: stay.destination,
        zoneCode: stay.zoneCode,
        appliedNationality: selected === null ? null : passport.nationality,
        status: evaluation.status,
        appliedRuleId: evaluation.appliedRuleId,
        category: evaluation.category,
        purpose: evaluation.purpose,
        workRights: evaluation.workRights,
        stay,
        violations: evaluation.violations,
        otherRequirements: evaluation.otherRequirements,
        alternativeRuleIds,
      });
    }

    const chosen =
      candidates.length > 0
        ? pickBestCoverage(candidates)
        : ({
            destination: stay.destination,
            zoneCode: stay.zoneCode,
            appliedNationality: null,
            status: 'unknown' as CoverageStatus,
            appliedRuleId: null,
            category: null,
            purpose: null,
            workRights: false,
            stay,
            violations: [],
            otherRequirements: [],
            alternativeRuleIds: [],
          } satisfies CountryCoverage);

    coverages.push(chosen);
    if (chosen.status === 'unknown') unknownCountries.push(stay.destination);
  }

  return ok({ coverages, unknownCountries });
}
