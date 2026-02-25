import type { Currency, Money } from '../trip/types';
import { money } from '../trip/types';
import type { SpendEntry } from './types';

/**
 * Calculates the total spend for a set of entries.
 * All entries must share the same currency.
 */
export function calculateTotalSpend(entries: readonly SpendEntry[]): Money {
  if (entries.length === 0) return money(0, 'GBP');

  // Validate that all entries share the same currency before summing.
  // Set iteration order is insertion order, so the first element is stable.
  const currencies = new Set(entries.map((e) => e.amount.currency));
  if (currencies.size > 1) {
    throw new Error(`calculateTotalSpend: mixed currencies (${[...currencies].join(', ')})`);
  }

  // Safe: entries is non-empty and currencies.size === 1, so the Set has exactly one element.
  const currency = [...currencies][0] as Currency;
  const total = entries.reduce((sum, entry) => sum + entry.amount.amountPence, 0);
  return money(total, currency);
}

/**
 * Groups spend entries by category.
 */
export function groupByCategory(entries: readonly SpendEntry[]): Map<string, SpendEntry[]> {
  const groups = new Map<string, SpendEntry[]>();
  for (const entry of entries) {
    const existing = groups.get(entry.category) ?? [];
    groups.set(entry.category, [...existing, entry]);
  }
  return groups;
}
