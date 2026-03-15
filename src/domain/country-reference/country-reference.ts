import type { ComfortLevel, Money } from '../trip/types';
import { money } from '../trip/types';
import type {
  CategoryBreakdown,
  CityBudgetEstimate,
  CityReference,
  CostConfidence,
  CountryReference,
} from './types';

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
 * Default category breakdown percentages when no city-specific data exists.
 * Based on typical mid-range travel patterns.
 */
export const DEFAULT_BREAKDOWN: CategoryBreakdown = {
  accommodation: 40,
  food: 25,
  transport: 20,
  activities: 15,
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

/**
 * Determines confidence level based on data provenance.
 *
 *   - high: city-specific manual data (curated research)
 *   - medium: city-specific estimated data (model-derived)
 *   - low: country-level fallback (no city data available)
 */
export function determineConfidence(cityRef: CityReference | null): CostConfidence {
  if (!cityRef) return 'low';
  return cityRef.source === 'manual' ? 'high' : 'medium';
}

/**
 * Calculates a city-aware budget estimate with confidence scoring.
 *
 * When city data is available, scales the country baseline by the city's
 * costMultiplier. Otherwise falls back to the country average with 'low' confidence.
 */
export function estimateCityBudget(
  days: number,
  countryRef: CountryReference,
  comfortLevel: ComfortLevel,
  cityRef: CityReference | null,
): CityBudgetEstimate {
  const comfortMultiplier = COMFORT_MULTIPLIERS[comfortLevel];
  const cityMultiplier = cityRef?.costMultiplier ?? 1.0;
  const dailyCostPence = Math.round(
    countryRef.avgDailyCostPence * cityMultiplier * comfortMultiplier,
  );
  const totalPence = Math.round(days * dailyCostPence);

  return {
    dailyCostPence,
    totalPence,
    currency: countryRef.currency,
    confidence: determineConfidence(cityRef),
    cityName: cityRef?.city ?? null,
    breakdown: DEFAULT_BREAKDOWN,
  };
}
