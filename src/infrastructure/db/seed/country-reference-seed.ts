/**
 * Country reference data seed.
 *
 * Average daily costs at mid-range comfort level, in GBP pence (2025/26 estimates).
 * Curated for destinations commonly visited on round-the-world trips.
 *
 * Comfort multipliers are applied at suggestion time — see domain/country-reference.ts.
 * To update costs: edit avgDailyCostPence and re-run `pnpm db:seed`.
 *
 * Costs cover: accommodation, food, local transport, and a modest activities allowance.
 * They exclude: international flights, travel insurance, and one-off visa fees.
 */
export const COUNTRY_REFERENCE_SEED: Array<{
  country: string;
  avgDailyCostPence: number;
  currency: string;
  source: string;
}> = [
  // ── Asia ──────────────────────────────────────────────────────────────────
  { country: 'Japan', avgDailyCostPence: 8_000, currency: 'GBP', source: 'manual' },
  { country: 'South Korea', avgDailyCostPence: 7_000, currency: 'GBP', source: 'manual' },
  { country: 'China', avgDailyCostPence: 5_000, currency: 'GBP', source: 'manual' },
  { country: 'Thailand', avgDailyCostPence: 3_500, currency: 'GBP', source: 'manual' },
  { country: 'Vietnam', avgDailyCostPence: 3_000, currency: 'GBP', source: 'manual' },
  { country: 'Cambodia', avgDailyCostPence: 2_500, currency: 'GBP', source: 'manual' },
  { country: 'Laos', avgDailyCostPence: 2_500, currency: 'GBP', source: 'manual' },
  { country: 'Indonesia', avgDailyCostPence: 3_000, currency: 'GBP', source: 'manual' },
  { country: 'Philippines', avgDailyCostPence: 2_500, currency: 'GBP', source: 'manual' },
  { country: 'Malaysia', avgDailyCostPence: 4_000, currency: 'GBP', source: 'manual' },
  { country: 'Singapore', avgDailyCostPence: 9_000, currency: 'GBP', source: 'manual' },
  { country: 'India', avgDailyCostPence: 2_500, currency: 'GBP', source: 'manual' },
  { country: 'Nepal', avgDailyCostPence: 3_000, currency: 'GBP', source: 'manual' },
  { country: 'Sri Lanka', avgDailyCostPence: 3_000, currency: 'GBP', source: 'manual' },
  // ── Middle East / Central Asia ────────────────────────────────────────────
  { country: 'Turkey', avgDailyCostPence: 4_000, currency: 'GBP', source: 'manual' },
  { country: 'Jordan', avgDailyCostPence: 5_000, currency: 'GBP', source: 'manual' },
  // ── Africa ────────────────────────────────────────────────────────────────
  { country: 'Morocco', avgDailyCostPence: 3_500, currency: 'GBP', source: 'manual' },
  { country: 'South Africa', avgDailyCostPence: 4_500, currency: 'GBP', source: 'manual' },
  // ── Europe ────────────────────────────────────────────────────────────────
  { country: 'Portugal', avgDailyCostPence: 6_000, currency: 'GBP', source: 'manual' },
  { country: 'Spain', avgDailyCostPence: 7_000, currency: 'GBP', source: 'manual' },
  { country: 'France', avgDailyCostPence: 10_000, currency: 'GBP', source: 'manual' },
  { country: 'Italy', avgDailyCostPence: 9_000, currency: 'GBP', source: 'manual' },
  { country: 'Greece', avgDailyCostPence: 6_000, currency: 'GBP', source: 'manual' },
  // ── Americas ──────────────────────────────────────────────────────────────
  { country: 'United States', avgDailyCostPence: 10_000, currency: 'GBP', source: 'manual' },
  { country: 'Canada', avgDailyCostPence: 9_000, currency: 'GBP', source: 'manual' },
  { country: 'Mexico', avgDailyCostPence: 4_000, currency: 'GBP', source: 'manual' },
  { country: 'Colombia', avgDailyCostPence: 3_500, currency: 'GBP', source: 'manual' },
  { country: 'Peru', avgDailyCostPence: 3_500, currency: 'GBP', source: 'manual' },
  { country: 'Brazil', avgDailyCostPence: 4_500, currency: 'GBP', source: 'manual' },
  { country: 'Argentina', avgDailyCostPence: 3_000, currency: 'GBP', source: 'manual' },
  { country: 'Chile', avgDailyCostPence: 5_000, currency: 'GBP', source: 'manual' },
  // ── Pacific ───────────────────────────────────────────────────────────────
  { country: 'Australia', avgDailyCostPence: 9_000, currency: 'GBP', source: 'manual' },
  { country: 'New Zealand', avgDailyCostPence: 8_500, currency: 'GBP', source: 'manual' },
];
