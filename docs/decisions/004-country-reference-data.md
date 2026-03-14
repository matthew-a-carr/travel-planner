# ADR 004: Country Reference Data and Budget Suggestion Engine

**Date:** 2026-02-23
**Status:** Partially superseded by ADR 034

## Context

The original brief requires the application to help users plan trip budgets using approximate
average daily costs per country/region. When a user adds a destination and specifies a country,
a duration (via start/end dates), and a comfort level, the system should suggest an estimated
budget rather than requiring the user to know it themselves.

There are two data source strategies:
1. **External API** — fetch live average daily costs from a third-party travel data API at
   request time (Numbeo, Budget Your Trip, etc.)
2. **Database-seeded reference table** — store static reference data in a `country_reference_data`
   table, seeded at deploy time and updated manually or via future API integration

We are also making a decision about how comfort level affects budget estimates. The domain stores
`comfortLevel` on each destination but has not yet applied it to any calculation.

## Decision

### Data source: DB-seeded reference table now; API connector later

We store reference data in a `country_reference_data` table, seeded at bootstrap with curated
mid-range daily cost figures (GBP, 2025/26 estimates). The domain defines a
`CountryReferenceRepository` interface; the infrastructure layer provides the Drizzle
implementation. This satisfies the original brief's "put interfaces in place so they're easy
to switch out later" requirement — a future `NumbeoReferenceRepository` or similar can be
injected without changing the domain or UI.

**GBP is the base currency for all reference data.** Other currencies are a future concern.

### Comfort level multipliers

Multipliers are a domain constant applied on top of the mid-range reference cost:

| Level   | Multiplier |
|---------|------------|
| budget  | 0.65×      |
| mid     | 1.0×       |
| luxury  | 1.8×       |

These are approximations. The domain exposes `COMFORT_MULTIPLIERS` as a typed constant so the
values are defined once and testable.

### Budget suggestion formula

```
suggestedBudgetPence = Math.round(days × avgDailyCostPence × multiplier)
```

Where `days` is derived from `destination.startDate` and `destination.endDate`. If either date
is missing, no suggestion is shown — the user must enter the budget manually.

### Destination duration (`destinationDays`)

A pure function `destinationDays` is added to the destination domain:

```typescript
destinationDays(destination): number | null
// returns null if either date is missing
// returns Math.ceil((endDate - startDate) / ms_per_day) otherwise
```

This is a computed property, not stored. Duration is always derived from the dates.

### UI: suggestion as hint, not auto-fill

The budget suggestion is shown as hint text beneath the estimated budget input field. It does
not auto-fill the field — the user retains full control. If the country is not found in the
reference data, no hint is shown.

The suggestion is computed client-side by passing the full `CountryReference[]` array to the
`AddDestinationForm` component as a prop from the server-rendered trip detail page. No client
API call is needed for the suggestion.

### Destination date inputs

Start date and end date inputs are added to the Add Destination form. Both remain optional.
The server action already accepts `Date | null` for both fields; the form now populates them.

## Implementation

### New files

| File | Purpose |
|---|---|
| `src/domain/country-reference/types.ts` | `CountryReference` value type |
| `src/domain/country-reference/country-reference.ts` | `suggestBudget`, `findReference`, `COMFORT_MULTIPLIERS` |
| `src/domain/country-reference/country-reference.test.ts` | Unit tests |
| `src/domain/country-reference/country-reference-repository.ts` | `CountryReferenceRepository` interface |
| `src/infrastructure/db/repositories/drizzle-country-reference-repository.ts` | Drizzle implementation |
| `src/infrastructure/db/seed/country-reference-seed.ts` | Seed script (25+ countries) |
| `src/application/use-cases/get-country-references.ts` | Simple list use case |

### Modified files

| File | Change |
|---|---|
| `src/infrastructure/db/schema.ts` | Add `countryReferenceData` table |
| `src/domain/destination/destination.ts` | Add `destinationDays` |
| `src/domain/destination/destination.test.ts` | Tests for `destinationDays` |
| `src/ui/components/AddDestinationForm.tsx` | Date inputs + suggestion hint |
| `src/ui/components/DestinationSection.tsx` | Accept references; show days in card |
| `src/app/trips/[id]/page.tsx` | Fetch references; pass to `DestinationSection` |
| `src/app/trips/[id]/actions.ts` | Parse start/end dates from form data |

## Consequences

- Budget suggestions make trip planning faster — users don't need to research daily costs.
- The suggestion is a starting point, not a constraint. Users can override freely.
- Adding the country reference repository interface now positions us for a future API connector
  (Starling/bank data is a different interface; this is a read-only reference data interface).
- `destinationDays` enables the burndown visualisation (next feature) which requires knowing
  how many days each destination spans.
- Seeded data must be updated manually when reference costs drift significantly. A future ADR
  will cover automated refresh via an external API.
