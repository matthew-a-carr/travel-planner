/**
 * Display formatting for the trips screens (SPEC-011). Deterministic and
 * locale-independent on purpose — Hermes' and Node's Intl tables differ,
 * and the formats here are part of the screen's tested contract.
 */

import type { WireComfortLevel, WireMoney } from '@travel-planner/shared';

const CURRENCY_SYMBOLS: Record<WireMoney['currency'], string> = {
  GBP: '£',
  USD: '$',
  EUR: '€',
  AUD: 'A$',
};

const MONTHS = [
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

/**
 * `£5,000` for whole-pound amounts, `£123.45` otherwise. Negative
 * amounts (over-allocated budgets) render as `-£50`.
 */
export function formatPence(money: WireMoney): string {
  const symbol = CURRENCY_SYMBOLS[money.currency];
  const sign = money.amountPence < 0 ? '-' : '';
  const absolute = Math.abs(money.amountPence);
  const units = Math.floor(absolute / 100);
  const remainder = absolute % 100;

  const grouped = units.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const minor = remainder === 0 ? '' : `.${remainder.toString().padStart(2, '0')}`;
  return `${sign}${symbol}${grouped}${minor}`;
}

/** `1 Sep 2026 – 21 Sep 2026`, `From …` / `Until …`, or `Dates TBC`. */
export function formatDateRange(startDate: string | null, endDate: string | null): string {
  if (startDate && endDate) return `${formatIsoDate(startDate)} – ${formatIsoDate(endDate)}`;
  if (startDate) return `From ${formatIsoDate(startDate)}`;
  if (endDate) return `Until ${formatIsoDate(endDate)}`;
  return 'Dates TBC';
}

const COMFORT_LABELS: Record<WireComfortLevel, string> = {
  budget: 'Budget',
  mid: 'Mid-range',
  luxury: 'Luxury',
};

/** Display label for a destination's comfort level. */
export function formatComfortLevel(level: WireComfortLevel): string {
  return COMFORT_LABELS[level];
}

/** `2026-09-01` → `1 Sep 2026`. Input is the wire's YYYY-MM-DD. */
export function formatIsoDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-');
  const monthIndex = Number(month) - 1;
  return `${Number(day)} ${MONTHS[monthIndex] ?? month} ${year}`;
}
