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
