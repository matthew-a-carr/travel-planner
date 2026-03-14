# Country Reference Data & Budget Estimation

Last updated: **March 14, 2026**

## What this system does

When a user adds a destination to a trip, the app suggests an estimated budget
based on the country, the number of days, and a comfort level (budget, mid-range,
or luxury). The system holds reference data for ~200 countries so it can produce
these suggestions.

This document explains where the data comes from, how estimated costs are
calculated, how the data gets into the database, and how to maintain it.

---

## Overview diagram

```
┌──────────────────────────────────────────────────────────────────┐
│  Developer machine (one-off script)                              │
│                                                                  │
│  scripts/fetch-countries.ts                                      │
│    │                                                             │
│    ├── 1. Fetch REST Countries API ──► country names, ISO codes  │
│    ├── 2. Fetch World Bank API ──────► GDP per capita PPP        │
│    ├── 3. Calibrate power-law model against 33 manual countries  │
│    └── 4. Write country-list-seed.ts (committed to git)          │
│                                                                  │
└──────────────────────────┬───────────────────────────────────────┘
                           │ git push
                           ▼
┌──────────────────────────────────────────────────────────────────┐
│  Vercel build pipeline (every deploy)                            │
│                                                                  │
│  pnpm build && pnpm db:migrate:deploy && pnpm db:seed            │
│                                    │                             │
│                                    └── Upserts ~200 rows into    │
│                                        country_reference_data    │
│                                        table (idempotent)        │
└──────────────────────────┬───────────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────────┐
│  Runtime (user-facing)                                           │
│                                                                  │
│  Server: loads all CountryReference[] and passes to forms         │
│  Client: CountryCombobox filters list, user selects a country    │
│  Client: suggestBudget() computes hint from days × cost × level  │
│  Server: action validates country exists before saving            │
└──────────────────────────────────────────────────────────────────┘
```

---

## Data sources

### 1. REST Countries API

- **URL:** `https://restcountries.com/v3.1/all`
- **What it provides:** canonical country names, ISO 3166-1 alpha-2 and alpha-3
  codes, region (e.g. "Asia", "Americas"), subregion (e.g. "South-Eastern Asia"),
  and whether the country is an independent sovereign state.
- **Cost:** completely free. No API key. No rate limiting for occasional use.
- **Filtering:** we include all independent sovereign states plus notable
  territories (Hong Kong, Macau, Taiwan, Puerto Rico, Palestine). This gives
  ~200 entries.

### 2. World Bank Open Data API

- **URL:** `https://api.worldbank.org/v2/country/all/indicator/NY.GDP.PCAP.PP.CD`
- **What it provides:** GDP per capita at purchasing power parity (PPP) in
  current international dollars. This is a standardised measure of how expensive
  a country is to live in, adjusted for local purchasing power.
- **Cost:** completely free. No API key. No rate limiting for occasional use.
- **Year selection:** the script tries 2024 first, then falls back to 2023 and
  2022 to find the most recent available data for each country. Some countries
  have no GDP data at all (~19 as of March 2026).

### 3. Manually curated cost data (33 countries)

The script contains a hardcoded `MANUAL_COSTS` object with 33 popular travel
destinations and their known mid-range daily travel costs in GBP pence. These
are based on travel research and represent what a typical mid-range traveller
would spend per day (accommodation, food, transport, activities).

**These manual costs are the ground truth.** They are always used in preference
to estimated values. Examples:

| Country       | Daily cost (GBP) | Source   |
|---------------|-------------------|----------|
| Japan         | £80               | Manual   |
| Thailand      | £35               | Manual   |
| France        | £100              | Manual   |
| India         | £25               | Manual   |
| United States | £100              | Manual   |
| Colombia      | £35               | Manual   |

The full list of 33 manually curated countries is in `scripts/fetch-countries.ts`
under `MANUAL_COSTS`.

---

## How cost estimation works

For the ~170 countries without manually curated cost data, the system estimates
daily travel costs using a statistical model.

### The calibration model

The relationship between a country's wealth (GDP PPP) and how expensive it is
to travel there follows a power law:

```
estimated_daily_cost = a × gdp_per_capita ^ b
```

Where:
- `a` and `b` are constants derived from fitting the model against the 33
  manually curated countries
- `gdp_per_capita` is the World Bank PPP figure for that country

The fit is calculated using **log-linear regression** (ordinary least squares on
the natural log of both variables). As of the last run:

- **Model:** `cost = 26.6838 × gdp ^ 0.5052`
- **R² = 0.7435** — this means the model explains about 74% of the variance in
  travel costs across countries. It's a reasonable fit for ballpark estimates,
  but not precise.

### What this means in practice

- Countries with higher GDP PPP get higher estimated daily costs
- The relationship is sub-linear (exponent ≈ 0.5), meaning that doubling GDP
  doesn't double the estimated travel cost — it increases it by about 41%
- Rich countries like Switzerland or Norway get high estimates (~£90–120/day)
- Low-income countries like Burundi or Sierra Leone get low estimates (~£15/day)

### Safety clamps

Estimated costs are clamped to prevent unreasonable outliers:

- **Minimum:** £15/day (1,500 pence) — prevents near-zero estimates
- **Maximum:** £200/day (20,000 pence) — prevents extreme outliers

### Fallback for countries with no GDP data

About 19 countries have no World Bank GDP data (e.g. some small island nations,
recently formed states). These receive a **default estimate of £40/day** (4,000
pence) and are tagged as `source: 'estimated'`.

---

## How comfort levels affect the suggestion

The estimated cost stored in the database is the **mid-range** daily cost.
When the app shows a budget suggestion to the user, it multiplies by a
comfort level factor:

| Comfort level | Multiplier | Effect                               |
|---------------|------------|--------------------------------------|
| Budget        | 0.65×      | Cheaper accommodation, street food   |
| Mid-range     | 1.0×       | Baseline — the stored reference cost |
| Luxury        | 1.8×       | Upscale hotels, fine dining          |

### Budget suggestion formula

```
suggested_budget = days × daily_cost_pence × comfort_multiplier
```

Where:
- `days` = number of days between destination start and end dates
- `daily_cost_pence` = the `avgDailyCostPence` from the database
- `comfort_multiplier` = 0.65, 1.0, or 1.8

**Example:** 14 days in Thailand (£35/day mid-range), luxury comfort:
```
14 × 3,500 × 1.8 = 88,200 pence = £882.00
```

The suggestion is shown as a hint below the budget input field. The user can
ignore it and enter any amount they like.

### UI labelling

The app distinguishes data quality in the suggestion text:

- **"Suggested £882"** — the country has manually curated cost data (high
  confidence)
- **"Estimated £650"** — the country's cost was derived from the GDP model
  (lower confidence, but still useful as a starting point)

---

## Database schema

Country reference data is stored in the `country_reference_data` table:

| Column              | Type    | Description                                    |
|---------------------|---------|------------------------------------------------|
| `id`                | serial  | Auto-incrementing primary key                  |
| `country`           | text    | Canonical country name (unique, e.g. "Japan")  |
| `alpha2`            | text    | ISO 3166-1 alpha-2 code (unique, e.g. "JP")    |
| `alpha3`            | text    | ISO 3166-1 alpha-3 code (unique, e.g. "JPN")   |
| `region`            | text    | Continent/region (e.g. "Asia", "Americas")      |
| `subregion`         | text    | Subregion (e.g. "South-Eastern Asia")           |
| `avgDailyCostPence` | integer | Mid-range daily cost in GBP pence               |
| `currency`          | text    | Always "GBP" currently                          |
| `source`            | text    | "manual" or "estimated"                         |
| `updatedAt`         | timestamp | Set on each seed run                          |

---

## How data gets into the database

### Seed file (committed to git)

The file `src/infrastructure/db/seed/country-list-seed.ts` contains all ~200
countries as a TypeScript array. This file is **auto-generated** by the
`scripts/fetch-countries.ts` script and committed to git. It should not be
edited by hand.

### Deploy-time seeding

Every Vercel deployment runs this build command:

```
pnpm build && pnpm db:migrate:deploy && pnpm db:seed
```

The `pnpm db:seed` step runs `src/infrastructure/db/seed/seed.ts`, which loops
through the seed array and performs an **upsert** for each country:

- If the country doesn't exist → `INSERT` a new row
- If the country already exists → `UPDATE` all fields

This is idempotent and safe to run repeatedly. It runs on every deploy, not
just the first one.

---

## How the user interacts with this

### Country selection (combobox)

Users cannot type a free-text country name. Instead, they use a searchable
dropdown (combobox) that filters the ~200 countries as they type. The combobox
supports:

- Typing a country name (substring match, case-insensitive)
- Typing an ISO code (e.g. "JP" or "JPN" for Japan)
- Keyboard navigation (arrow keys, Enter to select, Escape to close)
- On blur without selection: reverts to the previously selected value

A hidden form field submits the exact country name to the server.

### Server-side validation

When a destination is added or edited, the server action looks up the submitted
country name in the `country_reference_data` table. If no match is found, it
rejects the request with "Please select a valid country from the list". This
prevents any invalid data from being saved, even if someone bypasses the
client-side combobox.

---

## How to maintain the data

### Refreshing the data (when to do it)

The data is **static** — it does not update automatically. You should regenerate
it when:

- World Bank releases new GDP figures (typically annually)
- You want to add or update manually curated costs for specific countries
- A new country is created or renamed
- You notice an estimate is wildly inaccurate for a specific destination

**There is no urgency.** GDP-based estimates change slowly (a few percent per
year). The manual costs are approximate by design.

### How to refresh

1. **Run the fetch script:**

   ```bash
   pnpm tsx scripts/fetch-countries.ts
   ```

   This fetches fresh data from both APIs, re-calibrates the model, and
   overwrites `src/infrastructure/db/seed/country-list-seed.ts`.

2. **Review the output:**

   The script prints:
   - How many countries were fetched
   - The calibration model coefficients and R²
   - A residual table comparing manual costs vs model estimates
   - Any warnings (e.g. countries with >30% estimation error)

3. **Format the generated file:**

   ```bash
   pnpm run format
   ```

4. **Review the diff, commit, and deploy:**

   ```bash
   git diff src/infrastructure/db/seed/country-list-seed.ts
   git add src/infrastructure/db/seed/country-list-seed.ts
   git commit -m "chore: refresh country reference data"
   ```

   The next deployment will automatically seed the updated data.

### How to update a manual cost

Edit the `MANUAL_COSTS` object in `scripts/fetch-countries.ts`. For example,
to update Japan's daily cost from £80 to £85:

```typescript
const MANUAL_COSTS: Record<string, number> = {
  Japan: 8_500,    // changed from 8_000 (£85/day instead of £80/day)
  // ... rest of countries
};
```

Then re-run the script as above. The manual cost will be used as-is, and the
calibration model will also be re-fitted using the updated value as a data
point.

### How to add a new manually curated country

Add a new entry to `MANUAL_COSTS` in `scripts/fetch-countries.ts`:

```typescript
const MANUAL_COSTS: Record<string, number> = {
  // ... existing entries
  'Costa Rica': 4_500,  // £45/day mid-range
};
```

The country name must exactly match the REST Countries API name. Run the script
to regenerate. The country will switch from `source: 'estimated'` to
`source: 'manual'`, and the UI will show "Suggested" instead of "Estimated".

---

## Key files

| File | Purpose |
|------|---------|
| `scripts/fetch-countries.ts` | Developer script that fetches APIs and generates the seed file |
| `src/infrastructure/db/seed/country-list-seed.ts` | Auto-generated seed data (~200 countries). Do not edit by hand |
| `src/infrastructure/db/seed/seed.ts` | Seed runner — upserts seed data into the database |
| `src/infrastructure/db/schema.ts` | Database schema definition (Drizzle ORM) |
| `src/domain/country-reference/types.ts` | `CountryReference` TypeScript type |
| `src/domain/country-reference/country-reference.ts` | `findReference()`, `suggestBudget()`, `COMFORT_MULTIPLIERS` |
| `src/ui/components/CountryCombobox.tsx` | Searchable country dropdown component |
| `src/ui/components/AddDestinationForm.tsx` | Add destination form (uses combobox) |
| `src/ui/components/EditDestinationForm.tsx` | Edit destination form (uses combobox) |
| `src/app/trips/[id]/actions.ts` | Server actions with country validation |
| `docs/decisions/004-country-reference-data.md` | Original ADR (initial 32-country system) |
| `docs/decisions/033-comprehensive-country-reference-data.md` | Current ADR (200-country system) |

---

## Limitations and known trade-offs

1. **Estimates are approximate.** The GDP-based model (R² ≈ 0.74) is a
   reasonable proxy but not precise. A country's GDP doesn't perfectly predict
   tourist costs — tourism infrastructure, exchange rates, and local pricing
   for foreigners all play a role. This is why the UI labels GDP-derived costs
   as "Estimated" rather than "Suggested".

2. **Data is static, not live.** Costs don't update automatically. If a
   currency crisis causes costs to change dramatically in a country, the
   database will be stale until someone re-runs the script.

3. **Manual costs are GBP-specific.** All costs are stored in GBP pence and
   assume a UK-based traveller. Exchange rate fluctuations are not accounted for.

4. **The £40/day fallback is arbitrary.** Countries with no GDP data get a
   blanket £40/day estimate. This is a rough global average but could be wrong
   for very cheap or very expensive countries.

5. **No country flags, currencies, or exchange rates.** The ISO codes (`alpha2`,
   `alpha3`) are stored and could enable these features in the future, but they
   are not currently used in the UI beyond the combobox filter.

---

## FAQ

### Are the prices real-time?

No. They are fixed values stored in the database, seeded from a generated file
at deploy time. They don't change unless someone re-runs the fetch script and
deploys the updated data.

### Do the APIs need API keys?

No. Both REST Countries and World Bank Open Data are completely free with no
authentication required.

### Will we get rate-limited?

Very unlikely. The script is run manually on a developer's machine, typically
at most a few times per year. These APIs handle millions of requests daily. The
script makes exactly 4 HTTP requests total (1 for countries, up to 3 for GDP
years).

### How accurate are the "estimated" costs?

They're within the right ballpark. The model explains ~74% of the variation in
travel costs, which means most estimates will be in a reasonable range but some
will be noticeably off. The clamping (£15–£200/day) prevents extreme outliers.
For important destinations, add them to `MANUAL_COSTS` to get precise figures.

### Can users enter a country not in the list?

No. The combobox only allows selection from the ~200 seeded countries. The
server action also validates against the database, so even API manipulation
can't bypass this.

### What happens if the APIs go down?

Nothing breaks. The generated seed file is committed to git. The APIs are only
used when a developer manually runs `scripts/fetch-countries.ts`. If the APIs
are down at that moment, the script will fail with an error and the existing
seed data remains unchanged.
