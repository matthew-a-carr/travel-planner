import type { ParsedItineraryRow } from '@/domain/timeline/types';

const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

const DEFAULT_CONTINGENCY_RATIO = 0.1; // 10% on top of the suggested per-row budgets
const BUDGET_ROUNDING_PENCE = 10_000; // round to nearest £100

const FALLBACK_TRIP_NAME = 'New trip';

/**
 * Derives a short, deterministic trip name from a list of parsed itinerary
 * rows. Falls back to a generic name when no countries are present.
 *
 * Examples:
 *   ["Vietnam"], Aug 2026                              → "Vietnam · Aug 2026"
 *   ["Vietnam", "Cambodia"], Aug–Sep 2026              → "Vietnam → Cambodia · Aug–Sep 2026"
 *   ["Vietnam", "Cambodia", "Laos"], Aug–Oct 2026      → "Vietnam → Cambodia → Laos · Aug–Oct 2026"
 *   ["A", "B", "C", "D", "E"]                          → "A → B +3 more · 2026"
 *   no rows                                            → "New trip"
 */
export function suggestTripName(rows: readonly ParsedItineraryRow[]): string {
  const countries = uniqueCountries(rows);
  if (countries.length === 0) return FALLBACK_TRIP_NAME;

  const dateSegment = formatDateRange(rows);
  const countrySegment = formatCountryList(countries);

  return dateSegment ? `${countrySegment} · ${dateSegment}` : countrySegment;
}

/**
 * Suggests a total trip budget in pence by summing the per-row
 * `suggestedBudgetPence` (skipping nulls) and adding a contingency. The
 * result is rounded up to the nearest £100 for a friendly default.
 *
 * Returns `null` when no row has a suggested budget — callers should fall
 * back to user input instead.
 */
export function suggestTripBudgetPence(
  rows: readonly ParsedItineraryRow[],
  contingencyRatio: number = DEFAULT_CONTINGENCY_RATIO,
): number | null {
  let sum = 0;
  let any = false;
  for (const row of rows) {
    if (row.suggestedBudgetPence !== null && row.suggestedBudgetPence > 0) {
      sum += row.suggestedBudgetPence;
      any = true;
    }
  }
  if (!any) return null;
  const withContingency = Math.ceil(sum * (1 + contingencyRatio));
  return Math.ceil(withContingency / BUDGET_ROUNDING_PENCE) * BUDGET_ROUNDING_PENCE;
}

function uniqueCountries(rows: readonly ParsedItineraryRow[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const row of rows) {
    const country = row.country.trim();
    if (country.length === 0) continue;
    if (seen.has(country)) continue;
    seen.add(country);
    result.push(country);
  }
  return result;
}

function formatCountryList(countries: readonly string[]): string {
  if (countries.length <= 3) return countries.join(' → ');
  const head = countries.slice(0, 2).join(' → ');
  const remainder = countries.length - 2;
  return `${head} +${remainder} more`;
}

function formatDateRange(rows: readonly ParsedItineraryRow[]): string | null {
  const dated = rows.filter((r): r is ParsedItineraryRow & { startDate: Date; endDate: Date } => {
    return r.startDate !== null && r.endDate !== null;
  });
  if (dated.length === 0) return null;

  const start = new Date(Math.min(...dated.map((r) => r.startDate.getTime())));
  const end = new Date(Math.max(...dated.map((r) => r.endDate.getTime())));

  const startMonth = MONTH_NAMES[start.getUTCMonth()];
  const endMonth = MONTH_NAMES[end.getUTCMonth()];
  const startYear = start.getUTCFullYear();
  const endYear = end.getUTCFullYear();

  if (startYear !== endYear) {
    return `${startMonth} ${startYear} – ${endMonth} ${endYear}`;
  }
  if (startMonth === endMonth) {
    return `${startMonth} ${startYear}`;
  }
  return `${startMonth}–${endMonth} ${startYear}`;
}
