# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
This project uses [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/).

## [1.1.0](https://github.com/matthew-a-carr/travel-planner/compare/v1.0.0...v1.1.0) (2026-03-01)


### Features

* **auth:** add dev-only local login fallback ([f131ae5](https://github.com/matthew-a-carr/travel-planner/commit/f131ae5789988e1d1625731ecc5c063874a99f84))


### Bug Fixes

* **e2e:** stabilize ci auth harness and test reliability ([5580ca2](https://github.com/matthew-a-carr/travel-planner/commit/5580ca2db9723c53defeb24ea86721a30e0f32f4))

## 1.0.0 (2026-03-01)


### Features

* **a11y:** add mobile-first responsive layout and WCAG 2.1 AA accessibility ([6651a0c](https://github.com/matthew-a-carr/travel-planner/commit/6651a0cbc222dcd438c02ef1cce9ab6b8e8a5d42))
* add integration test suite, fix code smells, automate releases ([#8](https://github.com/matthew-a-carr/travel-planner/issues/8)) ([8c56c1c](https://github.com/matthew-a-carr/travel-planner/commit/8c56c1c130382ae19c6b87e85723b5a9c44457de))
* add spend entry delete and edit ([cd33275](https://github.com/matthew-a-carr/travel-planner/commit/cd332758157ba8f6cb34585a4bc6b5393b9debcc))
* bootstrap travel-planner project scaffold ([fbd4c29](https://github.com/matthew-a-carr/travel-planner/commit/fbd4c2994f6ef1df9f790b93a51be5d6fe358fb4))
* **country-reference:** add budget suggestion engine and destination dates ([f6b0625](https://github.com/matthew-a-carr/travel-planner/commit/f6b0625f68ee88c230928f908cbf75ae7512efb9))
* destination management, spend recording, and e2e scaffolding ([44a2604](https://github.com/matthew-a-carr/travel-planner/commit/44a2604ecda9bdf8087a8d74c5c4b25f00cf4259))
* **destination:** add destination editing; fix CI build (lazy DB client) ([45287af](https://github.com/matthew-a-carr/travel-planner/commit/45287afc8245db447501e142ab863b60f34dfcf2))
* **dev:** bootstrap local dev db and stabilize integration runs ([c3931ef](https://github.com/matthew-a-carr/travel-planner/commit/c3931efce05e3a7a9875d6cba54de940809d6fd5))
* **e2e:** self-contained Testcontainers PostgreSQL for e2e tests ([26a1b72](https://github.com/matthew-a-carr/travel-planner/commit/26a1b728ffb58f6dd292101fa1de9e9a31747284))
* **fixed-costs+charts:** replace ringfenced amount with named cost items; add Recharts charts ([c8b4c8c](https://github.com/matthew-a-carr/travel-planner/commit/c8b4c8c6193d89c6b653b58d351cd3dfedb24729))
* trip creation, persistence, and detail page ([96770a4](https://github.com/matthew-a-carr/travel-planner/commit/96770a46ba2fd3b7f67435d674de0616d85f6c3c))


### Bug Fixes

* **ci:** fix e2e build failures — local fonts and proxy migration ([e6e7d4e](https://github.com/matthew-a-carr/travel-planner/commit/e6e7d4effbbcedd1f5f83d583acad08ea65e5ac0))
* **ci:** generate drizzle migration journal; add pre-commit/pre-push hooks ([ebf3d65](https://github.com/matthew-a-carr/travel-planner/commit/ebf3d658c9a7a3d94c18aadbc5ce0dbb1b4b1182))
* **ci:** resolve build failure — dummy POSTGRES_URL for next build ([03e4782](https://github.com/matthew-a-carr/travel-planner/commit/03e47820e5a44806aa0b854d214375f7956b9d61))
* **e2e:** check pathname only in auth redirect assertion ([01c0b45](https://github.com/matthew-a-carr/travel-planner/commit/01c0b45275e667ef2e933540daa692cae2d11d20))
* **e2e:** update trip creation test to match current UI (ADR 005) ([1c72fea](https://github.com/matthew-a-carr/travel-planner/commit/1c72fea956903b76d1d4ed3ce8c89ceee015ff21))

## [Unreleased]

### Added

- Terraform infrastructure under `infra/` with split stacks for production and
  preview environments (`infra/stacks/prod`, `infra/stacks/preview`) and reusable
  modules for Vercel and Neon resources.
- New infrastructure GitHub workflows:
  - `infra-validate.yml` for Terraform fmt/validate and migration SQL policy checks
  - `infra-prod.yml` for production stack apply
  - `infra-preview.yml` for per-PR preview stack apply/cleanup
- Deployment migration command `pnpm db:migrate:deploy` with PostgreSQL advisory
  locking for safer concurrent deploy behavior.
- Transaction-safety guard `pnpm db:check:migrations` to reject migration SQL
  statements that cannot run safely in transaction-scoped deploy migrations.
- Edit trip: users can now update a trip's name, total budget, and status
  (planning / active / completed) via an Edit trip button on the trip detail page.
  Reducing the budget below existing fixed costs + destination allocations is
  rejected with a clear error message (ADR 013).
- `validateTripBudgetEdit` domain guard enforces the budget invariant on edits.
- Integration test for `get-country-references` use case (previously missing).
- `seedCountryReference` factory in the test harness (`src/infrastructure/testing/helpers.ts`).
- Dev-only local login fallback: in development, a one-click **Sign in locally (dev)**
  path is now available for manual testing without configuring Google OAuth. The
  local flow provisions/reuses a stable test user so trip ownership remains
  consistent across sessions.

### Changed

- Vercel build command is now intended to run migrations in deployment:
  `pnpm build && pnpm db:migrate:deploy`.
- Preview auth configuration now supports `AUTH_ENABLE_LOCAL_DEV=true` to allow
  local-dev credentials in preview deployments while production remains SSO-only.
- Integration test files renamed from `.test.ts` to `.int-test.ts` suffix; Vitest config
  now uses file-suffix globs (`src/**/*.int-test.ts`) so new integration tests are
  auto-discovered without updating the config (ADR 012)
- Local development startup is now one command: `pnpm dev` auto-starts a
  throwaway Postgres container via Testcontainers when `POSTGRES_URL` is
  missing, runs migrations + reference-data seed, injects safe auth env
  defaults for local bootstrapping, and auto-detects Docker context settings
  (including Colima socket overrides)
- `.env.example` no longer hard-codes `POSTGRES_URL`, so local setup defaults
  to auto-bootstrapped Postgres unless developers opt into a custom database.
- CI: `unit-test` job now runs `pnpm test:unit`; new `integration-test` job runs
  `pnpm test:integration` in stage 2; E2E gate moved to stage 3 (needs integration-test)
- `CONTRIBUTING.md`: added test file naming convention table and mandatory pre-push
  checklist
- Auth sign-in UX now adapts to configured providers:
  - Development: local dev login is always shown.
  - Development: Google login is shown only when `AUTH_GOOGLE_ID` and
    `AUTH_GOOGLE_SECRET` are non-placeholder values.
  - Production: local dev login is hidden.

### Fixed

- Production Google SSO avatars now render correctly by allowing Google-hosted
  profile image domains in Next.js image configuration and falling back to
  initials if an avatar URL cannot be loaded.
- Dark mode accessibility across dashboard and trip detail pages: low-contrast
  text, cards, forms, and modal surfaces now use explicit dark-theme colors;
  create/edit trip modals no longer render as bright white overlays in dark mode.
- Added dark-mode accessibility regression coverage in Playwright for the
  dashboard create-trip modal and trip detail page.
- Lint: replaced non-null assertion (`!`) in `helpers.ts` and `spend-entry.ts` with
  explicit null-checks (biome `noNonNullAssertion`)
- TypeScript: `global-setup.ts` container teardown now returns `Promise<void>` to satisfy
  the `containerStop` type
- `DestinationSection.tsx`: corrected JSX fragment indentation (biome format)
- Dev auth: local-dev sign-in no longer depends on `ON CONFLICT (email)` upsert semantics,
  preventing `CallbackRouteError` on drifted local schemas where the expected unique
  constraint is missing.

## [0.4.0] - 2026-02-25

### Added

- Integration test suite: repository layer (5 files) and application use-case layer (9 files)
  tested against a real PostgreSQL database via Testcontainers — no mocks; ~55 new tests
- Reusable test harness: `src/infrastructure/testing/helpers.ts` with `createTestDb()`,
  `truncateAll()`, and typed seed factories (`seedUser`, `seedTrip`, `seedDestination`,
  `seedFixedCost`, `seedSpendEntry`) consumed by all integration test files
- `vitest-mock-extended` dev dependency for Mockito-style mocking in future adapter tests
- `pnpm test:unit` and `pnpm test:integration` scripts; Vitest projects split (unit runs
  without Docker, integration starts a Testcontainers Postgres container)
- `nextFixedCostSortOrder` pure domain function extracted to `src/domain/trip/trip.ts`
- `toSpendCategory()` and `toComfortLevel()` type-guard helpers in server actions — eliminates
  all unsafe `as SpendCategory` / `as ComfortLevel` casts
- Error states on remove/delete UI actions: `DestinationCard`, `SpendEntryRow`, and
  `FixedCostRow` now surface network/server errors to the user rather than silently swallowing
  them inside `useTransition`
- Spend entry edit and delete E2E tests (`tests/e2e/03-spend.spec.ts`)
- Trip detail page accessibility audit at three canonical viewports
  (`tests/e2e/accessibility.spec.ts`)
- Release Please GitHub Actions workflow (`.github/workflows/release-please.yml`) for
  automated versioning, CHANGELOG generation, and GitHub Releases from conventional commits
- ADR 011 documenting the GBP-only MVP currency decision
- `CONTRIBUTING.md` internal team guide: prerequisites, setup, test commands, commit
  conventions, branch workflow, and release process

### Fixed

- `createTripAction` now returns `{ error: string | null }` consistent with all other server
  actions — previously it `throw`s, forcing `CreateTripForm` to wrap it in a `.catch()` shim
- `calculateTotalSpend` now throws on mixed-currency entries instead of silently returning
  the wrong total
- `removeDestination` use case no longer accepts a dead `ownerId` parameter
- `COMFORT_LABELS` extracted from inside `DestinationCard` render to module-level constant

### Added

- Destination editing: each destination card now has an **Edit** button that expands an inline
  form pre-filled with the existing name, country, estimated budget, comfort level, and dates;
  the budget suggestion hint is shown (same as when adding); changes are saved immediately and
  all budget totals update in real time
- `validateDestinationEdit` domain function — uses a delta approach: only a budget *increase*
  consumes available headroom, so `canAllocateBudget` is called with `newBudget − oldBudget`
  rather than the full new amount, avoiding any exclusion logic
- `editDestination` application use case
- `editDestinationAction` server action (verifies trip ownership before mutating)
- `EditDestinationForm` client component

### Fixed

- Application failed to build in CI (`next build`) because `auth/index.ts` called
  `DrizzleAdapter(getDb(), …)` at module-evaluation time without a database available;
  `auth/index.ts` now imports the shared `db` singleton from `client.ts` (removing the
  duplicate connection) and `next build` is run with a syntactically-valid dummy
  `POSTGRES_URL` — the `postgres` library is lazy so no TCP connection is ever opened
  during the build phase (see ADR 010)

### Also in this branch (previous commit)

- Spend entry editing: each recorded spend item now shows an **Edit** button that expands
  an inline form pre-filled with the existing amount, date, category, and description; changes
  are saved immediately and the page reflects the updated totals
- Spend entry deletion: a **Delete** button on each spend item removes the entry and recalculates
  the destination's total spend in real time
- `deleteSpendEntry` and `editSpendEntry` application use cases
- `deleteSpendEntryAction` and `editSpendEntryAction` server actions (both verify trip ownership
  before mutating)
- `EditSpendEntryForm` client component

### Also in this branch (previous commit)

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
