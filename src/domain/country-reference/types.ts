import type { Currency } from '../trip/types';

/**
 * Average daily travel cost for a country at mid-range comfort level.
 * All costs are stored in GBP pence. Comfort level multipliers are applied
 * at suggestion time — see country-reference.ts.
 *
 * `source` tracks provenance so we know whether a row was manually curated
 * or fetched from an external API (future CountryReferenceRepository implementation).
 */
export type CountryReference = {
  readonly country: string;
  readonly avgDailyCostPence: number; // mid-range baseline, always integer pence
  readonly currency: Currency; // GBP for all seeded data
  readonly source: 'manual' | 'api';
};
