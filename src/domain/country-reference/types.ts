import type { Currency } from '../trip/types';

/**
 * Average daily travel cost for a country at mid-range comfort level.
 * All costs are stored in GBP pence. Comfort level multipliers are applied
 * at suggestion time — see country-reference.ts.
 *
 * `source` tracks provenance:
 *   - 'manual'    — curated by a human with travel-specific research
 *   - 'estimated' — derived from World Bank GDP PPP data via calibrated model
 */
export type CountryReference = {
  readonly country: string;
  readonly alpha2: string; // ISO 3166-1 alpha-2, e.g. "JP"
  readonly alpha3: string; // ISO 3166-1 alpha-3, e.g. "JPN"
  readonly region: string | null; // e.g. "Asia", "Americas"
  readonly subregion: string | null; // e.g. "South-Eastern Asia"
  readonly avgDailyCostPence: number; // mid-range baseline, always integer pence
  readonly currency: Currency; // GBP for all seeded data
  readonly source: 'manual' | 'estimated';
};

/**
 * City-level daily cost override.
 *
 * When available, provides a more accurate budget estimate than the
 * country-level average. For example, Tokyo is ~50% more expensive
 * than the Japan average, while Osaka is closer to the national mean.
 *
 * `costMultiplier` scales the country's `avgDailyCostPence`:
 *   - 1.0 = same as country average
 *   - 1.5 = 50% more expensive
 *   - 0.7 = 30% cheaper
 */
export type CityReference = {
  readonly city: string; // canonical city name, e.g. "Tokyo"
  readonly country: string; // FK to CountryReference.country
  readonly costMultiplier: number; // relative to country avgDailyCostPence
  readonly source: 'manual' | 'estimated';
};

export type CostConfidence = 'high' | 'medium' | 'low';

export type CityBudgetEstimate = {
  readonly dailyCostPence: number;
  readonly totalPence: number;
  readonly currency: Currency;
  readonly confidence: CostConfidence;
  readonly cityName: string | null; // null when falling back to country-level
  readonly breakdown: CategoryBreakdown;
};

export type CategoryBreakdown = {
  readonly accommodation: number; // percentage 0-100
  readonly food: number;
  readonly transport: number;
  readonly activities: number;
};
