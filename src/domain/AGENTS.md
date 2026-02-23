# Domain Layer — AGENTS.md

> Rules for `src/domain/`. These override nothing in the root AGENTS.md — they add specificity.

## Hard rules

- **ZERO external imports.** No `next`, `drizzle`, `@vercel/*`, `react`, or any npm package.
- **No `async` functions.** Domain logic is synchronous and pure.
- **No exceptions.** Return `Result<T, E>` for operations that can fail.
- **No I/O.** No `fetch`, `fs`, database calls, or side effects of any kind.

These rules are enforced by `src/__tests__/architecture.test.ts`. Violations break the test suite.

## Structure

```
src/domain/
  trip/
    types.ts          ← Money, Trip, Destination, SpendEntry, Result helpers
    trip.ts           ← budget invariant functions (pure)
    trip.test.ts
    trip-repository.ts ← TripRepository interface (implemented in infrastructure/)
  destination/
    destination.ts    ← validateNewDestination, nextSortOrder, sortDestinations
    destination.test.ts
    destination-repository.ts
  spending/
    spend-entry.ts    ← getTotalSpend, getSpendByCategory
    spend-entry.test.ts
    spend-entry-repository.ts
```

## Testing

```bash
pnpm test -- src/domain          # run all domain tests
pnpm test -- src/domain/trip     # run trip domain tests only
```

Every new domain function MUST have a corresponding unit test. Write the test first.

## Adding new domain logic

1. Define types in `types.ts` (or a new `types.ts` in the subdomain folder).
2. Write failing tests in `*.test.ts`.
3. Implement pure functions in `*.ts`.
4. Export the repository interface if infrastructure adapters are needed.
5. Do NOT import the repository implementation here — interfaces only.
