# ADR 011: GBP-Only Currency in MVP

**Date:** 2026-02-25
**Status:** Accepted

## Context

The Travel Planner domain model includes a `Currency` type (`'GBP' | 'USD' | 'EUR' | 'AUD'`) and
a `Money` value object that tracks both `amountPence` and `currency`. This architecture was designed
to support multiple currencies in the future.

However, the current MVP hardcodes GBP in several places:

- All Drizzle repositories store and retrieve amounts using `currency: 'GBP'`
- All server actions pass `currency: 'GBP'` to use cases
- Seed factories default to `currency: 'GBP'`
- `calculateTotalSpend` falls back to `'GBP'` for empty entry lists

Sites are annotated with `// GBP-only: see ADR 011` to make the constraint visible.

## Decision

The MVP ships GBP-only. Multi-currency support is deferred until there is a validated user need.

The `Currency` type and `Money` value object remain in the domain layer as the correct long-term
model — they cost nothing to keep and avoid a future structural refactor.

## Consequences

**Easier:**
- No currency conversion logic required
- Budget comparisons are always valid (same currency)
- UI always shows `£` symbol — no locale/format complexity

**Harder / future work:**
To add multi-currency support, the following changes would be needed:

1. **Schema**: Add a `currency` column to `destinations`, `spend_entries` (currently implicit GBP);
   `trip_fixed_costs` already has `currency` column.
2. **Repositories**: Read and write `currency` from DB columns instead of hardcoding `'GBP'`.
3. **Server actions**: Expose currency selection in forms; pass the chosen currency to use cases.
4. **Domain**: Implement currency conversion (exchange-rate service or fixed ECB rates) and decide
   whether budget totals are always in the trip's base currency or shown per-currency.
5. **UI**: Update all money displays to use the entry's currency, not always `£`.
