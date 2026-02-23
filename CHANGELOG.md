# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
This project uses [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/).

## [Unreleased]

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
