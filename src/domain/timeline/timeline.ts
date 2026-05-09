import { findReference, suggestBudget } from '../country-reference/country-reference';
import type { CountryReference } from '../country-reference/types';
import { destinationDays } from '../destination/destination';
import type { Destination } from '../trip/types';
import type { TimelineFinding } from './types';

const MS_PER_DAY = 1000 * 60 * 60 * 24;

const BUDGET_LOW_RATIO = 0.7;
const BUDGET_HIGH_RATIO = 2;
const GAP_DAYS_WARNING_THRESHOLD = 7;

function pounds(pence: number): string {
  return `£${(pence / 100).toFixed(0)}`;
}

function datedDestinations(
  destinations: readonly Destination[],
): (Destination & { startDate: Date; endDate: Date })[] {
  return destinations
    .filter(
      (d): d is Destination & { startDate: Date; endDate: Date } =>
        d.startDate !== null && d.endDate !== null,
    )
    .slice()
    .sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
}

export function detectGaps(destinations: readonly Destination[]): TimelineFinding[] {
  const dated = datedDestinations(destinations);
  const findings: TimelineFinding[] = [];
  for (let i = 0; i < dated.length - 1; i++) {
    const prev = dated[i];
    const next = dated[i + 1];
    const gapDays = Math.round((next.startDate.getTime() - prev.endDate.getTime()) / MS_PER_DAY);
    if (gapDays > 1) {
      findings.push({
        stopId: next.id,
        severity: gapDays > GAP_DAYS_WARNING_THRESHOLD ? 'warning' : 'info',
        kind: 'gap',
        message: `${gapDays}-day gap between ${prev.name} and ${next.name}.`,
        suggestion: 'Add a stop in between, or extend one of the surrounding destinations.',
      });
    }
  }
  return findings;
}

export function detectOverlaps(destinations: readonly Destination[]): TimelineFinding[] {
  const dated = datedDestinations(destinations);
  const findings: TimelineFinding[] = [];
  for (let i = 0; i < dated.length - 1; i++) {
    const prev = dated[i];
    const next = dated[i + 1];
    if (next.startDate < prev.endDate) {
      const overlapDays = Math.max(
        1,
        Math.round((prev.endDate.getTime() - next.startDate.getTime()) / MS_PER_DAY),
      );
      findings.push({
        stopId: next.id,
        severity: 'danger',
        kind: 'overlap',
        message: `${prev.name} and ${next.name} overlap by ${overlapDays} day${overlapDays === 1 ? '' : 's'}.`,
        suggestion: `Adjust ${prev.name}'s end date or ${next.name}'s start date.`,
      });
    }
  }
  return findings;
}

export function flagBudgetVsReference(
  destinations: readonly Destination[],
  references: readonly CountryReference[],
): TimelineFinding[] {
  const findings: TimelineFinding[] = [];
  for (const dest of destinations) {
    const days = destinationDays(dest);
    if (days === null) continue;
    const ref = findReference(dest.country, references);
    if (!ref) continue;
    const suggested = suggestBudget(days, ref, dest.comfortLevel);
    const estimated = dest.estimatedBudget.amountPence;
    if (estimated <= 0 || suggested.amountPence <= 0) continue;

    const ratio = estimated / suggested.amountPence;
    if (ratio < BUDGET_LOW_RATIO) {
      const shortfall = Math.round((1 - ratio) * 100);
      findings.push({
        stopId: dest.id,
        severity: 'warning',
        kind: 'budget-low',
        message: `${dest.name} budget (${pounds(estimated)}) is ${shortfall}% below the ${dest.comfortLevel} reference for ${ref.country}.`,
        suggestion: `Consider raising to around ${pounds(suggested.amountPence)} or switching to a lower comfort level.`,
      });
    } else if (ratio > BUDGET_HIGH_RATIO) {
      const overage = Math.round((ratio - 1) * 100);
      findings.push({
        stopId: dest.id,
        severity: 'info',
        kind: 'budget-high',
        message: `${dest.name} budget (${pounds(estimated)}) is ${overage}% above the ${dest.comfortLevel} reference for ${ref.country}.`,
        suggestion: 'Generous — consider redistributing to other destinations.',
      });
    }
  }
  return findings;
}

export function detectDeterministicFindings(
  destinations: readonly Destination[],
  references: readonly CountryReference[],
): TimelineFinding[] {
  return [
    ...detectGaps(destinations),
    ...detectOverlaps(destinations),
    ...flagBudgetVsReference(destinations, references),
  ];
}

/**
 * Merge two finding lists, deduping by (stopId, kind). Earlier entries win,
 * so deterministic findings should be passed first.
 */
export function mergeFindings(
  primary: readonly TimelineFinding[],
  secondary: readonly TimelineFinding[],
): TimelineFinding[] {
  const key = (f: TimelineFinding) => `${f.stopId ?? '_'}::${f.kind}`;
  const seen = new Set<string>();
  const merged: TimelineFinding[] = [];
  for (const f of [...primary, ...secondary]) {
    const k = key(f);
    if (seen.has(k)) continue;
    seen.add(k);
    merged.push(f);
  }
  return merged;
}

/**
 * Returns the [min start, max end] date range covering all dated destinations.
 * Returns null if no destination has both dates set.
 */
export function timelineDateRange(
  destinations: readonly Destination[],
): { start: Date; end: Date } | null {
  const dated = datedDestinations(destinations);
  if (dated.length === 0) return null;
  const start = dated[0].startDate;
  const end = dated.reduce(
    (latest, d) => (d.endDate > latest ? d.endDate : latest),
    dated[0].endDate,
  );
  return { start, end };
}
