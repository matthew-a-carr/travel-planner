import type { Money } from '../trip/types';
import { money } from '../trip/types';
import type { SpendEntry } from './types';

/**
 * Calculates the total spend for a set of entries.
 * All entries must share the same currency.
 */
export function calculateTotalSpend(entries: readonly SpendEntry[]): Money {
  if (entries.length === 0) return money(0, 'GBP');

  const currency = entries[0]?.amount.currency;
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
