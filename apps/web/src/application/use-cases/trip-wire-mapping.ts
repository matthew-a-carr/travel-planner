import type { WireMoney } from '@travel-planner/shared';
import type { Money } from '@/domain/trip/types';

/**
 * Shared domain→wire mapping helpers for the v1 trip read surface
 * (SPEC-009 list / SPEC-010 detail). Destination dates are date-only in
 * the domain, so the wire format is `YYYY-MM-DD`.
 */

export function toWireMoney(money: Money): WireMoney {
  return { amountPence: money.amountPence, currency: money.currency };
}

export function toIsoDate(date: Date | null): string | null {
  return date === null ? null : (date.toISOString().split('T')[0] as string);
}

/** Earliest non-null date as `YYYY-MM-DD`, else null. */
export function earliestIsoDate(dates: ReadonlyArray<Date | null>): string | null {
  return pickDate(dates, (a, b) => (a.getTime() <= b.getTime() ? a : b));
}

/** Latest non-null date as `YYYY-MM-DD`, else null. */
export function latestIsoDate(dates: ReadonlyArray<Date | null>): string | null {
  return pickDate(dates, (a, b) => (a.getTime() >= b.getTime() ? a : b));
}

function pickDate(
  dates: ReadonlyArray<Date | null>,
  pick: (a: Date, b: Date) => Date,
): string | null {
  let chosen: Date | null = null;
  for (const date of dates) {
    if (date === null) continue;
    chosen = chosen === null ? date : pick(chosen, date);
  }
  return toIsoDate(chosen);
}
