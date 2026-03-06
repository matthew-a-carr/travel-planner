# Architecture Decision Records

This directory contains ADRs (Architecture Decision Records) for the Travel Planner project.

New ADRs follow the template in [`000-template.md`](./000-template.md).
See [CONSTITUTION.md §7](../../CONSTITUTION.md) for naming rules and the trigger criteria in [AGENTS.md](../../AGENTS.md).

## Index

| ADR | Title | Date | Status |
|-----|-------|------|--------|
| [001](001-initial-stack.md) | Initial Technology Stack | 2026-02-22 | Accepted |
| [002](002-biome.md) | Migrate from ESLint + TypeScript-ESLint to Biome | 2026-02-22 | Accepted |
| [003](003-atdd-destination-spend-dashboard-approach.md) | ATDD-Driven Approach for Destination, Spend, and Budget Dashboard Features | 2026-02-22 | Accepted |
| [004](004-country-reference-data.md) | Country Reference Data and Budget Suggestion Engine | 2026-02-23 | Accepted |
| [005](005-trip-fixed-costs.md) | Trip Fixed Costs — Replacing the Single Ringfenced Amount | 2026-02-23 | Accepted |
| [006](006-charts.md) | Charts — Recharts for Trip Budget Visualisation | 2026-02-23 | Accepted |
| [007](007-mobile-first-accessibility.md) | Mobile-First Responsive Design and WCAG 2.1 AA Accessibility | 2026-02-23 | Accepted |
| [008](008-ci-pipeline-structure-and-dependabot.md) | CI Pipeline Structure and Automated Dependency Updates | 2026-02-23 | Accepted |
| [009](009-testcontainers-e2e-postgres.md) | Testcontainers for E2E PostgreSQL | 2026-02-23 | Accepted |
| [010](010-build-time-postgres-url-pattern.md) | Build-time POSTGRES_URL Pattern for next build | 2026-02-23 | Accepted |
| [011](011-gbp-only-currency.md) | GBP-Only Currency in MVP | 2026-02-25 | Accepted |
| [012](012-integration-test-naming-convention.md) | Integration Test File Naming Convention (`.int-test.ts`) | 2026-02-25 | Accepted |
| [013](013-trip-status-transition-model.md) | Trip Status Transition Model | 2026-02-26 | Accepted |
| [014](014-development-local-auth-fallback.md) | Development Local Auth Fallback | 2026-03-01 | Accepted |
| [015](015-native-git-hooks-via-core-hookspath.md) | Native Git Hooks via `core.hooksPath` | 2026-03-01 | Accepted |
| [016](016-terraform-cloud-split-state-no-cli-workspaces.md) | Terraform Cloud Split State with No CLI Workspaces | 2026-03-06 | Accepted |
| [017](017-neon-community-terraform-provider.md) | Use Community Terraform Provider for Neon | 2026-03-06 | Accepted |
| [018](018-vercel-deployment-migration-gate.md) | Run Drizzle Migrations in Vercel Deployment with Transactional Safety Gate | 2026-03-06 | Accepted |
| [019](019-preview-local-dev-auth-override.md) | Preview Local-Dev Auth Override via AUTH_ENABLE_LOCAL_DEV | 2026-03-06 | Accepted |
| [020](020-vercel-web-analytics.md) | Vercel Web Analytics Integration | 2026-03-06 | Accepted |
| [021](021-organization-scoped-trip-sharing-and-first-sign-in-bootstrap.md) | Organization-Scoped Trip Sharing and First-Sign-In Bootstrap | 2026-03-06 | Accepted |
| [022](022-trip-hard-delete-owner-only.md) | Owner-Only Hard Delete for Trips | 2026-03-06 | Accepted |
| [023](023-shared-header-and-settings-route-for-organization-management.md) | Shared Header and Settings Route for Organization Management | 2026-03-06 | Superseded by ADR 024 |
| [024](024-two-row-sticky-header-for-authenticated-navigation.md) | Two-Row Sticky Header for Authenticated Navigation | 2026-03-06 | Accepted |
| [025](025-controlled-signup-and-admin-access-management.md) | Controlled Signup and Admin Access Management | 2026-03-06 | Accepted |
| [026](026-searchable-organization-member-assignment-from-user-directory.md) | Searchable Organization Member Assignment from User Directory | 2026-03-06 | Accepted |
| [027](027-separate-organization-creation-from-member-management.md) | Separate Organization Creation from Member Management | 2026-03-06 | Accepted |
