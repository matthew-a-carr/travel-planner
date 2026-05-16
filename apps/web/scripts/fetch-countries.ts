/**
 * Developer script: fetch country reference data and estimate daily travel costs.
 *
 * Usage:  tsx scripts/fetch-countries.ts
 *
 * 1. Fetches the canonical country list from the REST Countries API.
 * 2. Fetches GDP per-capita PPP from the World Bank Open Data API.
 * 3. Calibrates a power-law cost model against manually curated countries.
 * 4. Writes the result to src/infrastructure/db/seed/country-list-seed.ts.
 *
 * NOT run in CI or at deploy time — the generated file is committed to the repo.
 * Re-run when country data or World Bank figures need refreshing (at most annually).
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// ── Types ──────────────────────────────────────────────────────────────────────

type RestCountry = {
  name: { common: string };
  cca2: string;
  cca3: string;
  region: string;
  subregion: string;
  independent: boolean | null;
};

type WorldBankEntry = {
  country: { id: string; value: string };
  countryiso3code: string;
  date: string;
  value: number | null;
};

type CountrySeed = {
  country: string;
  alpha2: string;
  alpha3: string;
  region: string;
  subregion: string;
  avgDailyCostPence: number;
  currency: string;
  source: 'manual' | 'estimated';
};

// ── Manually curated countries (ground truth for calibration) ──────────────────

const MANUAL_COSTS: Record<string, number> = {
  Japan: 8_000,
  'South Korea': 7_000,
  China: 5_000,
  Thailand: 3_500,
  Vietnam: 3_000,
  Cambodia: 2_500,
  Laos: 2_500,
  Indonesia: 3_000,
  Philippines: 2_500,
  Malaysia: 4_000,
  Singapore: 9_000,
  India: 2_500,
  Nepal: 3_000,
  'Sri Lanka': 3_000,
  Turkey: 4_000,
  Jordan: 5_000,
  Morocco: 3_500,
  'South Africa': 4_500,
  Portugal: 6_000,
  Spain: 7_000,
  France: 10_000,
  Italy: 9_000,
  Greece: 6_000,
  'United States': 10_000,
  Canada: 9_000,
  Mexico: 4_000,
  Colombia: 3_500,
  Peru: 3_500,
  Brazil: 4_500,
  Argentina: 3_000,
  Chile: 5_000,
  Australia: 9_000,
  'New Zealand': 8_500,
};

// ── Notable non-independent territories to include ─────────────────────────────

const NOTABLE_TERRITORIES = new Set([
  'HK', // Hong Kong
  'MO', // Macau
  'TW', // Taiwan
  'PR', // Puerto Rico
  'PS', // Palestine
  'XK', // Kosovo (may not be in the API)
]);

// ── API fetching ───────────────────────────────────────────────────────────────

async function fetchCountries(): Promise<RestCountry[]> {
  const url =
    'https://restcountries.com/v3.1/all?fields=name,cca2,cca3,region,subregion,independent';
  console.log(`[fetch] Fetching country list from ${url}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`REST Countries API returned ${res.status}`);
  return (await res.json()) as RestCountry[];
}

async function fetchGdpPerCapitaPPP(): Promise<Map<string, number>> {
  // Try most recent years first, fall back if no data
  const years = ['2024', '2023', '2022'];
  const gdpMap = new Map<string, number>();

  for (const year of years) {
    const url = `https://api.worldbank.org/v2/country/all/indicator/NY.GDP.PCAP.PP.CD?date=${year}&format=json&per_page=400`;
    console.log(`[fetch] Fetching GDP per capita PPP for ${year}…`);
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`[fetch] World Bank API returned ${res.status} for year ${year}, skipping.`);
      continue;
    }

    const json = (await res.json()) as [unknown, WorldBankEntry[] | null];
    const entries = json[1];
    if (!entries) continue;

    for (const entry of entries) {
      if (entry.value !== null && !gdpMap.has(entry.countryiso3code)) {
        gdpMap.set(entry.countryiso3code, entry.value);
      }
    }

    console.log(`[fetch] Got GDP data for ${gdpMap.size} countries (up to ${year}).`);
    if (gdpMap.size > 150) break; // good enough
  }

  return gdpMap;
}

// ── Power-law calibration ──────────────────────────────────────────────────────

/**
 * Fits model: cost = a × gdp^b using log-linear regression.
 *
 * ln(cost) = ln(a) + b × ln(gdp)
 *
 * Returns { a, b, rSquared }.
 */
function calibrate(
  dataPoints: Array<{ gdp: number; cost: number }>,
): { a: number; b: number; rSquared: number } {
  const n = dataPoints.length;
  if (n < 2) throw new Error('Need at least 2 data points for calibration');

  const lnGdps = dataPoints.map((d) => Math.log(d.gdp));
  const lnCosts = dataPoints.map((d) => Math.log(d.cost));

  const sumX = lnGdps.reduce((s, v) => s + v, 0);
  const sumY = lnCosts.reduce((s, v) => s + v, 0);
  const sumXY = lnGdps.reduce((s, v, i) => s + v * lnCosts[i], 0);
  const sumX2 = lnGdps.reduce((s, v) => s + v * v, 0);

  const b = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const lnA = (sumY - b * sumX) / n;
  const a = Math.exp(lnA);

  // R² calculation
  const meanY = sumY / n;
  const ssTotal = lnCosts.reduce((s, v) => s + (v - meanY) ** 2, 0);
  const ssResidual = lnCosts.reduce((s, v, i) => s + (v - (lnA + b * lnGdps[i])) ** 2, 0);
  const rSquared = 1 - ssResidual / ssTotal;

  return { a, b, rSquared };
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const countries = await fetchCountries();
  const gdpMap = await fetchGdpPerCapitaPPP();

  // Filter: sovereign states + notable territories
  const filtered = countries.filter(
    (c) => c.independent === true || NOTABLE_TERRITORIES.has(c.cca2),
  );
  console.log(
    `[filter] ${filtered.length} countries after filtering (${countries.length} total from API).`,
  );

  // Build calibration dataset: pair manual costs with GDP data
  const calibrationPoints: Array<{ country: string; gdp: number; cost: number }> = [];
  for (const [name, cost] of Object.entries(MANUAL_COSTS)) {
    const match = filtered.find((c) => c.name.common === name);
    if (!match) {
      console.warn(`[calibration] Manual country "${name}" not found in REST Countries API.`);
      continue;
    }
    const gdp = gdpMap.get(match.cca3);
    if (gdp === undefined) {
      console.warn(`[calibration] No GDP data for "${name}" (${match.cca3}).`);
      continue;
    }
    calibrationPoints.push({ country: name, gdp, cost });
  }

  console.log(`[calibration] ${calibrationPoints.length} data points for calibration.`);

  const { a, b, rSquared } = calibrate(calibrationPoints);
  console.log(`[calibration] Model: cost = ${a.toFixed(4)} × gdp^${b.toFixed(4)}`);
  console.log(`[calibration] R² = ${rSquared.toFixed(4)}`);

  if (rSquared < 0.5) {
    console.warn('[calibration] WARNING: R² is low — estimated costs may be unreliable.');
  }

  // Log calibration residuals for review
  console.log('\n[calibration] Residuals (manual vs estimated):');
  for (const point of calibrationPoints) {
    const estimated = Math.round(a * point.gdp ** b);
    const diff = point.cost - estimated;
    const pct = ((diff / point.cost) * 100).toFixed(0);
    const marker = Math.abs(Number(pct)) > 30 ? ' ⚠️' : '';
    console.log(
      `  ${point.country.padEnd(20)} manual=${point.cost}  estimated=${estimated}  diff=${diff > 0 ? '+' : ''}${diff} (${pct}%)${marker}`,
    );
  }

  // Generate seed entries
  const seeds: CountrySeed[] = [];
  let estimatedCount = 0;
  let noGdpCount = 0;

  for (const c of filtered) {
    const manualCost = MANUAL_COSTS[c.name.common];
    const gdp = gdpMap.get(c.cca3);

    let avgDailyCostPence: number;
    let source: 'manual' | 'estimated';

    if (manualCost !== undefined) {
      avgDailyCostPence = manualCost;
      source = 'manual';
    } else if (gdp !== undefined) {
      avgDailyCostPence = Math.round(a * gdp ** b);
      // Clamp to reasonable range: minimum £15/day, maximum £200/day
      avgDailyCostPence = Math.max(1_500, Math.min(20_000, avgDailyCostPence));
      source = 'estimated';
      estimatedCount++;
    } else {
      // No GDP data — use regional median as fallback
      avgDailyCostPence = 4_000; // £40/day default
      source = 'estimated';
      noGdpCount++;
    }

    seeds.push({
      country: c.name.common,
      alpha2: c.cca2,
      alpha3: c.cca3,
      region: c.region || '',
      subregion: c.subregion || '',
      avgDailyCostPence,
      currency: 'GBP',
      source,
    });
  }

  seeds.sort((x, y) => x.country.localeCompare(y.country));

  console.log(
    `\n[result] ${seeds.length} countries: ${Object.keys(MANUAL_COSTS).length} manual, ${estimatedCount} estimated, ${noGdpCount} fallback.`,
  );

  // Write the seed file
  const q = (v: string) => `'${v.replace(/'/g, "\\'")}'`;

  const lines = seeds.map(
    (s) =>
      [
        '  {',
        `    country: ${q(s.country)},`,
        `    alpha2: ${q(s.alpha2)},`,
        `    alpha3: ${q(s.alpha3)},`,
        `    region: ${q(s.region)},`,
        `    subregion: ${q(s.subregion)},`,
        `    avgDailyCostPence: ${formatPence(s.avgDailyCostPence)},`,
        `    currency: ${q(s.currency)},`,
        `    source: ${q(s.source)},`,
        '  },',
      ].join('\n'),
  );

  const fileContent = `/**
 * Country reference seed data.
 *
 * AUTO-GENERATED by scripts/fetch-countries.ts — do not edit manually.
 *
 * Sources:
 *   - Country list: REST Countries API (https://restcountries.com)
 *   - Cost estimates: World Bank GDP per-capita PPP, calibrated against manual data
 *   - Manual costs: curated mid-range daily travel costs in GBP pence
 *
 * Refresh: run \`tsx scripts/fetch-countries.ts\` to regenerate.
 *
 * Calibration model: cost = ${a.toFixed(4)} × gdp^${b.toFixed(4)} (R² = ${rSquared.toFixed(4)})
 */
export const COUNTRY_LIST_SEED: Array<{
  country: string;
  alpha2: string;
  alpha3: string;
  region: string;
  subregion: string;
  avgDailyCostPence: number;
  currency: string;
  source: 'manual' | 'estimated';
}> = [
${lines.join('\n')}
];
`;

  const scriptDir = dirname(fileURLToPath(import.meta.url));
  const outPath = join(scriptDir, '..', 'src', 'infrastructure', 'db', 'seed', 'country-list-seed.ts');
  writeFileSync(outPath, fileContent, 'utf8');
  console.log(`\n[output] Wrote ${seeds.length} entries to ${outPath}`);
}

function formatPence(pence: number): string {
  if (pence >= 1_000) {
    const thousands = Math.floor(pence / 1_000);
    const remainder = pence % 1_000;
    if (remainder === 0) return `${thousands}_000`;
    return `${thousands}_${String(remainder).padStart(3, '0')}`;
  }
  return String(pence);
}

main().catch((err: unknown) => {
  console.error('[fatal]', err);
  process.exit(1);
});
