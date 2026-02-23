# ADR 003: ATDD-Driven Approach for Destination, Spend, and Budget Dashboard Features

**Date:** 2026-02-22
**Status:** Accepted

## Features in scope

1. Destination management UI (add / list / remove destinations per trip)
2. Spend entry recording (log a spend against a destination)
3. Budget dashboard with visual breakdown (per-destination allocation, spend vs budget)
4. Playwright e2e test setup and scaffolding (ATDD — tests drive the above)

Out of scope for this phase: AI cost estimation, currency conversion (deferred to later ADRs).

## Test-first approach (TDD / ATDD)

All features follow this order:

1. **Write the e2e test** (Playwright) describing the user journey — this is the acceptance criterion.
2. **Write domain unit tests** for any new domain logic before implementing it.
3. **Implement** just enough to make both pass.
4. **Lint + type-check + test** must all pass before committing.

No feature is considered done until its e2e test passes against a running app.

For this bootstrap phase, e2e tests will run against `localhost` (not a deployed URL). The CI pipeline skips e2e by default (requires a running server + DB); they are run locally with `pnpm test:e2e`.

## Domain additions

### Destination aggregate

New domain logic required:
- `addDestination(trip, existing, newDestination)` — validates ringfence constraint before insert
- `removeDestination(destination)` — pure (no side effects in domain)
- `updateDestinationBudget(trip, existing, destinationId, newAmount)` — re-validates allocation invariant

### SpendEntry aggregate

New domain logic:
- `recordSpend(destination, entry)` — validates amount is positive
- `getTotalSpend(entries)` — already exists in `spend-entry.ts`
- `getSpendByCategory(entries)` — already exists in `spend-entry.ts`

## Repository additions

- `DestinationRepository`: `findByTrip(tripId)`, `save(destination)`, `delete(id)`
- `SpendEntryRepository`: `findByDestination(destinationId)`, `findByTrip(tripId)`, `save(entry)`, `delete(id)`

Both follow the same pattern as `DrizzleTripRepository`: interface in domain, implementation in infrastructure.

## Use cases (application layer)

- `addDestination(tripRepo, destRepo, input)` — fetches trip, validates, saves
- `removeDestination(destRepo, id)` — deletes
- `recordSpend(destRepo, spendRepo, input)` — fetches destination, validates, saves

## UI routes

| Route | Purpose |
|---|---|
| `GET /trips/[id]` | Trip detail — budget summary + destination list |
| `POST /trips/[id]/destinations` | Add destination (server action) |
| `DELETE /trips/[id]/destinations/[destId]` | Remove destination (server action) |
| `POST /trips/[id]/destinations/[destId]/spend` | Record spend (server action) |

## Budget dashboard

Displayed on `/trips/[id]`:
- Total budget / ringfenced / allocated / available (already built)
- Progress bar per destination: estimated budget vs actual spend
- Warning badge when a destination is over-spend
- Overall trip allocation percentage bar (already built)

## Playwright setup

- Install `@playwright/test`
- `playwright.config.ts` targeting `localhost:3000`
- `tests/e2e/` for test files
- CI: separate job `e2e` (optional/skipped without DB; documented)
- Auth handled via mock session or test user seeding

## Commit strategy

Each feature ships as a focused commit:
1. `test: add e2e scaffolding and Playwright config`
2. `feat: destination domain logic and repository`
3. `feat: add destination UI and server actions`
4. `feat: spend entry domain logic and repository`
5. `feat: record spend UI and server actions`
6. `feat: budget dashboard visual breakdown`
