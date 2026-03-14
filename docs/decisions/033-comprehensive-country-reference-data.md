# ADR 033: Comprehensive Country Reference Data with Automated Sourcing

**Date:** 2026-03-14
**Status:** Accepted
**Supersedes:** ADR 004 (partially — extends the data sourcing and input mechanism;
comfort multipliers and suggestion formula from ADR 004 are unchanged)

## Context

ADR 004 introduced country reference data with 32 manually curated countries and
free-text country input. This had three problems:

1. **Coverage gap** — only 32 of ~200 countries had reference data. Users
   travelling to unlisted countries received no budget suggestion.
2. **Free-text input** — users could type anything (misspellings, cities,
   regions), making data unreliable and breaking the reference data lookup.
3. **Manual maintenance** — adding or updating countries required a developer
   to edit the seed file. No repeatable pipeline existed.

The brief requires support for "everywhere possible" including Americas, Central
America, Sri Lanka, South East Asia, and Middle East — and sourcing must be free
(no paid APIs).

## Decision

### Data sourcing: REST Countries + World Bank GDP PPP calibration

Two free, public, no-API-key-required data sources provide comprehensive
coverage:

1. **REST Countries API** (`restcountries.com/v3.1/all`) — canonical country
   names, ISO 3166-1 alpha-2/alpha-3 codes, region, and subregion for all
   sovereign states and notable territories (~200 entries).

2. **World Bank Open Data API** (`api.worldbank.org/v2/country/all/indicator/NY.GDP.PCAP.PP.CD`)
   — GDP per capita at purchasing power parity (PPP) for ~180 countries.

A **power-law calibration model** (`cost = a × gdp^b`) is fitted against the
32 manually curated countries to derive estimated daily travel costs for all
remaining countries. The model achieves R² ≈ 0.74, which is sufficient for
ballpark budget suggestions. Each country's `source` field is tagged as either
`'manual'` (curated data) or `'estimated'` (derived from the model).

### Developer-time script, not runtime fetch

A `scripts/fetch-countries.ts` script fetches both APIs, calibrates the model,
and generates `src/infrastructure/db/seed/country-list-seed.ts`. This runs on a
developer's machine (not in CI or at runtime) and the output is committed to the
repository. This avoids runtime API dependencies, network failures during
deployment, and rate-limiting concerns.

The regeneration workflow is:

```
pnpm tsx scripts/fetch-countries.ts   # fetch + calibrate + generate
pnpm run format                        # biome format
# review diff, commit
```

### Deploy-time seeding

The Vercel build command is extended to:

```
pnpm build && pnpm db:migrate:deploy && pnpm db:seed
```

The seed script uses idempotent upserts (`INSERT ... ON CONFLICT DO UPDATE`),
so it is safe to run on every deployment. New countries are added, existing
countries are updated, and no data is deleted.

### Schema extensions

The `country_reference_data` table gains four columns:

| Column      | Type   | Constraint     |
|-------------|--------|----------------|
| `alpha2`    | text   | NOT NULL UNIQUE |
| `alpha3`    | text   | NOT NULL UNIQUE |
| `region`    | text   | nullable        |
| `subregion` | text   | nullable        |

A two-phase migration (add nullable → backfill → set NOT NULL) ensures safe
deployment against existing data.

### Combobox replaces free-text input

The country `<input type="text">` in both `AddDestinationForm` and
`EditDestinationForm` is replaced with a `CountryCombobox` component following
the WAI-ARIA combobox pattern:

- Type-ahead filtering by country name, alpha-2, or alpha-3 code
- Keyboard navigation (ArrowDown/Up, Enter, Escape, Home, End)
- Hidden `<input>` for form submission (only valid selections submit)
- On blur without valid selection: reverts to last valid value or clears

### Server-side validation

Both `addDestinationAction` and `editDestinationAction` validate the submitted
country value against `countryReferenceRepository.findByCountry()`. Invalid
values are rejected with `"Please select a valid country from the list"`.

### Budget suggestion labelling

The budget suggestion hint now distinguishes data quality:

- **"Suggested £X"** — country has manually curated cost data (`source: 'manual'`)
- **"Estimated £X"** — country has model-derived cost data (`source: 'estimated'`)

Comfort level multipliers (budget 0.65×, mid 1.0×, luxury 1.8×) and the
suggestion formula from ADR 004 are unchanged.

## Implementation

### New files

| File | Purpose |
|---|---|
| `scripts/fetch-countries.ts` | Developer script: fetch APIs, calibrate model, generate seed |
| `src/infrastructure/db/seed/country-list-seed.ts` | Generated: 200 countries with costs |
| `src/ui/components/CountryCombobox.tsx` | Accessible combobox with filtering |
| `src/ui/components/CountryCombobox.test.ts` | Unit tests for `filterCountries` |
| `drizzle/0006_dizzy_stellaris.sql` | Two-phase migration for ISO columns |

### Modified files

| File | Change |
|---|---|
| `src/infrastructure/db/schema.ts` | Add alpha2, alpha3, region, subregion columns |
| `src/domain/country-reference/types.ts` | Add ISO codes and region to type |
| `src/infrastructure/db/repositories/drizzle-country-reference-repository.ts` | Map new columns |
| `src/infrastructure/db/seed/seed.ts` | Import generated seed, upsert all fields |
| `src/ui/components/AddDestinationForm.tsx` | Replace text input with combobox |
| `src/ui/components/EditDestinationForm.tsx` | Replace text input with combobox |
| `src/app/trips/[id]/actions.ts` | Server-side country validation |
| `tests/e2e/02-destinations.spec.ts` | Combobox interaction in e2e tests |
| `infra/stacks/prod/main.tf` | Add `pnpm db:seed` to build command |

### Deleted files

| File | Reason |
|---|---|
| `src/infrastructure/db/seed/country-reference-seed.ts` | Replaced by generated country-list-seed.ts |

## Consequences

- **Better coverage:** ~200 countries vs 32. Users travelling to any recognised
  country get a budget suggestion.
- **Better data quality:** free-text input is eliminated. Server-side validation
  ensures only valid countries are stored.
- **Repeatable refresh:** running `fetch-countries.ts` regenerates the full
  seed file. Adding manual overrides is a one-line edit to the script.
- **Model accuracy:** R² ≈ 0.74 means estimated costs are approximate. The UI
  clearly labels these as "Estimated" to set expectations. Manual overrides for
  popular destinations remain the gold standard.
- **Deploy-time cost:** seeding ~200 rows on every deploy adds negligible time
  (~1s) to the build. The upsert is idempotent and safe.
- **Future extension:** the `alpha2`/`alpha3` columns enable future features
  like flag icons, currency conversion, and regional grouping.
