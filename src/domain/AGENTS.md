# Domain Layer — AGENTS.md

> Rules for `src/domain/`. These add specificity to the root AGENTS.md.

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
    types.ts              ← Money, Trip, TripFixedCost, Destination, SpendEntry, Result helpers
    trip.ts               ← budget invariant functions (pure)
    trip.test.ts
    trip-repository.ts    ← TripRepository interface
    fixed-cost-repository.ts ← TripFixedCostRepository interface
  destination/
    destination.ts        ← validateNewDestination, validateDestinationEdit, validateDateRange,
                             destinationDays, nextSortOrder, sortDestinations
    destination.test.ts
    destination-repository.ts ← DestinationRepository interface
  spending/
    spend-entry.ts        ← calculateTotalSpend, getSpendByCategory
    spend-entry.test.ts
    spend-entry-repository.ts ← SpendEntryRepository interface
  country-reference/
    country-reference.ts  ← findReference, suggestBudget (budget suggestion engine)
    country-reference.test.ts
    types.ts              ← CountryReference type
  organization/
    types.ts              ← Organization, Membership, role, and listing types
    organization.ts       ← personal workspace naming + permission helpers
    organization.test.ts
    organization-repository.ts ← OrganizationRepository interface
  user-access/
    types.ts              ← app-level user access views (approval/admin/idp/org links)
    delete-user.ts        ← domain constraints for soft-deletion
    delete-user.test.ts
    user-access-repository.ts ← UserAccessRepository interface
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
