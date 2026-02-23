import type { ComfortLevel, Money } from '../trip/types';
import { money } from '../trip/types';
import type { CountryReference } from './types';

/**
 * Multipliers applied to the mid-range reference cost based on comfort preference.
 * Defined in the domain so they are testable and used consistently
 * across the suggestion engine and any future AI cost-estimation feature.
 */
export const COMFORT_MULTIPLIERS: Record<ComfortLevel, number> = {
  budget: 0.65,
  mid: 1.0,
  luxury: 1.8,
};

/**
 * Finds a country reference by name, case-insensitive and whitespace-trimmed.
 * Returns null if no matching reference exists — callers should handle the
 * absence gracefully (no suggestion shown) rather than throwing.
 */
export function findReference(
  country: string,
  references: readonly CountryReference[],
): CountryReference | null {
  const normalised = country.toLowerCase().trim();
  return references.find((r) => r.country.toLowerCase() === normalised) ?? null;
}

/**
 * Calculates a suggested budget for a destination.
 *
 * Formula: Math.round(days × avgDailyCostPence × comfortMultiplier)
 *
 * The result is a mid-range estimate scaled by comfort level.
 * Intended as a planning aid — users can override freely.
 */
export function suggestBudget(
  days: number,
  reference: CountryReference,
  comfortLevel: ComfortLevel,
): Money {
  const multiplier = COMFORT_MULTIPLIERS[comfortLevel];
  const rawPence = Math.round(days * reference.avgDailyCostPence * multiplier);
  return money(rawPence, reference.currency);
}
