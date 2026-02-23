# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
This project uses [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/).

## [Unreleased]

### Added

- Trip fixed costs: `trip_fixed_costs` table replaces single `ringfenced_amount` field; users
  can now add named line items (flights, insurance, phone contract, Netflix, etc.) each deducted
  from the available budget; add/remove per trip from a new `FixedCostSection` on the trip page
- `TripFixedCost` domain type, `TripFixedCostRepository` interface, `DrizzleTripFixedCostRepository`
- `calculateTotalFixedCosts` domain function; `calculateAvailableBudget`, `canAllocateBudget`, and
  `getTripBudgetSummary` now accept `fixedCosts[]` instead of a single ringfenced amount
- `addFixedCost` and `removeFixedCost` application use cases
- `drizzle/0000_initial_schema.sql` — complete SQL migration covering all tables including
  `trip_fixed_costs` and `country_reference_data` (replaces `drizzle-kit push` for production)
- Charts via Recharts: budget breakdown donut (fixed costs / destinations / available), estimated
  vs actual grouped bar per destination, spend by category donut — all computed server-side and
  passed as props; rendered conditionally when data exists
- ADR 005 (trip fixed costs) and ADR 006 (charts) documenting design decisions
- 6 new unit tests for `calculateTotalFixedCosts` and updated budget tests; total: 66 passing

### Changed

- `CreateTripForm` simplified — ringfenced fieldset removed; hardcoded "Australia Visa & Living"
  defaults gone; hint text directs user to add fixed costs after trip creation
- Budget overview card now shows per-line fixed cost deductions instead of a single "Ringfenced"
  row
- `addDestination` use case now accepts `TripFixedCostRepository` to validate budget including
  all fixed costs
- Dashboard trip cards: removed ringfenced label display (no longer on `Trip` type)

### Also in this branch (previous commit)

- Country reference data: `country_reference_data` DB table seeded with 33 countries and their
  mid-range daily travel costs in GBP pence (Japan £80/day, Thailand £35/day, etc.)
- `CountryReference` domain type, `CountryReferenceRepository` interface, and
  `DrizzleCountryReferenceRepository` implementation
- `findReference` and `suggestBudget` pure domain functions, with 14 unit tests
- `COMFORT_MULTIPLIERS` constant (budget 0.65×, mid 1.0×, luxury 1.8×) used by suggestion engine
- `destinationDays` domain function deriving trip duration from start/end dates, with 6 unit tests
- `getCountryReferences` application use case
- `pnpm db:seed` script — idempotent upsert of country reference seed data
- Budget suggestion hint on Add Destination form: when country + dates + comfort level are filled,
  shows "Suggested £X,XXX — N days in [Country] (mid-range)" beneath the budget input
- Start/end date inputs on Add Destination form (both optional)
- Duration display ("· 45 days") shown on destination cards when dates are set
- ADR 004 documenting the country reference data design decisions

### Changed

- `AddDestinationForm` is now a controlled component tracking country, dates, and comfort level
  for client-side suggestion computation — no server round-trip needed
- `DestinationSection` now accepts and forwards `countryReferences` prop
- Trip detail page now fetches country references in parallel with destinations and spend
- Server action `addDestinationAction` now parses optional `startDate` / `endDate` fields

### Also in this branch (previous commit)

- `CONSTITUTION.md` section 1 "The Harness": enforcement map table, feedback loop command, and
  context efficiency rules derived from OpenAI harness engineering principles
- Per-layer `AGENTS.md` files in `src/domain/`, `src/application/`, `src/infrastructure/`
- `AGENTS.md` restructured as concise operational quick-reference
- Application renamed from "Wanderlust Budget" to "Travel Planner" throughout codebase
- `README.md` replaced auto-generated Next.js starter with project-specific content

## [0.3.0] - 2026-02-23

### Added

- Destination management: add and remove destinations per trip, validated against the trip's
  budget allocation invariant (allocated + ringfenced ≤ total)
- Spend recording: log expenditure against a destination with amount, date, category, and
  optional description
- Budget dashboard: per-destination spend progress bars and over-spend warning badges on the
  trip detail page
- Playwright e2e test scaffolding with acceptance criteria for auth, trips, destinations, and
  spend flows (auth-required tests skip gracefully without `PLAYWRIGHT_AUTH_TOKEN`)
- `DestinationRepository` and `SpendEntryRepository` interfaces in the domain layer
- `DrizzleDestinationRepository` and `DrizzleSpendEntryRepository` infrastructure
  implementations
- `addDestination`, `removeDestination`, and `recordSpend` application use cases
- `validateNewDestination` and `nextSortOrder` domain functions with full unit test coverage

### Changed

- Trip detail page redesigned with `BudgetOverviewCard` showing total / ringfenced /
  allocated / available budget rows plus a progress bar

## [0.2.0] - 2026-02-22

### Added

- Biome v2 replaces ESLint + Prettier + typescript-eslint as the single lint/format tool
- ADR 002 documenting the rationale for the Biome migration

### Changed

- All source files reformatted to Biome style (single quotes, 100-column, trailing commas)
- Import organisation delegated to Biome's assist action

### Removed

- ESLint, typescript-eslint, and related packages removed from devDependencies

## [0.1.0] - 2026-02-22

### Added

- Initial project bootstrap: Next.js 15, TypeScript strict mode, pnpm, Tailwind CSS v4
- DDD-inspired layered architecture: `domain/` → `application/` → `infrastructure/` → `ui/`
- Drizzle ORM schema: users, accounts, sessions, trips, destinations, spend entries tables
- Auth.js v5 with Google OAuth and Drizzle adapter; JWT session strategy
- Route protection middleware
- Trip aggregate with budget invariant logic (`calculateAvailableBudget`,
  `canAllocateBudget`, `getTripBudgetSummary`)
- Destination and SpendEntry domain types with validation functions
- Create Trip form with modal, server action, and Drizzle persistence
- Dashboard listing all trips for the authenticated user
- Trip detail page with budget summary card
- Vitest unit tests (34 passing); architecture tests enforcing layer import boundaries
- GitHub Actions CI pipeline: lint → type-check → test
- ADR 001 documenting the initial stack decisions
