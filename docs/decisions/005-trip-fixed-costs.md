# ADR 005: Trip Fixed Costs — Replacing the Single Ringfenced Amount

**Date:** 2026-02-23
**Status:** Accepted

## Context

The original model used a single `ringfencedAmount` + `ringfencedLabel` field on the `trips` table
to represent a reserved budget that could not be allocated to destinations (e.g. flights, visas).
This model has two problems:

1. **Single value only** — a trip commonly has multiple distinct fixed costs: flights, travel
   insurance, visa fees, ongoing subscriptions (phone contract, streaming services). A single amount
   cannot distinguish between these or display them individually.
2. **Hardcoded defaults** — the `CreateTripForm` shipped with "Australia Visa & Living" at £16,000
   as the default label and value. This is specific to one user's trip, not a general default.

## Decision

Replace `ringfencedAmount` and `ringfencedLabel` on the `trips` table with a new
`trip_fixed_costs` table. Each row represents one named fixed cost:

```
trip_fixed_costs
  id          uuid PK
  trip_id     uuid FK → trips.id ON DELETE CASCADE
  label       text   NOT NULL    -- "Flights to Asia", "Phone contract", "Netflix"
  amount_pence integer NOT NULL  -- pre-calculated total, user decides (e.g. £40/mo × 6 = £240)
  currency    text    NOT NULL DEFAULT 'GBP'
  sort_order  integer NOT NULL DEFAULT 0
  created_at  timestamp NOT NULL DEFAULT NOW()
```

The user enters a pre-calculated total — there is no built-in recurring multiplication. The label
is free-form so users can document their reasoning: *"Phone (£40/mo × 6)"*. This keeps the data
model simple while remaining expressive.

### Budget invariant unchanged in spirit

`available = total − sum(fixedCosts) − sum(destinationAllocations)`

`sum(fixedCosts)` replaces the old scalar `ringfencedAmount`. The domain function signatures that
were `fn(trip, destinations)` become `fn(trip, destinations, fixedCosts)`.

### No data migration required

The `ringfencedAmount` columns existed in schema and code but no real user data was stored.
The columns are dropped and the new table is added in a single migration.

### `CreateTripForm` simplified

The ringfenced fieldset (with the hardcoded "Australia Visa & Living" default) is removed. A trip
is created with just a name and total budget. Fixed costs are added after creation via a dedicated
`FixedCostSection` on the trip detail page, alongside destinations.

## Consequences

- Multiple named fixed costs can be tracked and shown individually on the budget overview.
- The budget calculation (`calculateAvailableBudget`, `canAllocateBudget`) now requires the
  `fixedCosts` array to be fetched and passed alongside destinations.
- The `addDestination` use case accepts a `TripFixedCostRepository` to fetch costs at validation time.
- The budget overview card shows a line item per fixed cost, replacing the single "Ringfenced" row.
- Australia reference data remains in the country reference seed (it is a universally-relevant
  destination); the Australia-specific defaults are removed from the UI.
