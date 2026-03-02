# ADR 008: CI Pipeline Structure and Automated Dependency Updates

**Date:** 2026-02-23
**Status:** Accepted

## Context

The original CI configuration (`ci.yml`) was a single job (`check`) that ran lint,
type-check, and unit tests sequentially. Two problems needed addressing:

1. **No e2e tests in CI.** The previous approach skipped e2e entirely in CI because
   the tests require a running server and a Postgres database. With the addition of
   `tests/e2e/accessibility.spec.ts` (ADR 007), excluding e2e from CI would leave
   accessibility and responsive-layout regressions undetected until manual testing.

2. **No automated dependency updates.** Dependencies were managed manually, meaning
   security patches and minor updates would accumulate unnoticed. A tooling decision
   was needed: which tool to use, and how to configure it to minimise noise.

## Decision

### CI pipeline structure

Split the single `check` job into five fully parallel jobs:

- `lint` — Biome code style and import ordering
- `type-check` — TypeScript strict-mode compilation
- `unit-test` — Vitest domain unit tests
- `integration-test` — Vitest repository and use-case tests against real Postgres via Testcontainers
- `e2e` — Playwright tests; builds the app then runs the full suite via Testcontainers

Rationale:
- All five jobs are independent of one another. None shares output or state with
  any other job, so there is no technical reason to impose ordering between them.
- Running everything in parallel gives the fastest possible wall-clock feedback —
  the pipeline completes as soon as the slowest job finishes rather than waiting
  for sequential stages.
- Separate named jobs appear as distinct status checks on pull requests, making it
  clear at a glance whether a failure is a lint issue, a type error, a unit test,
  an integration regression, or an e2e regression.
- Both `integration-test` and `e2e` manage their own throwaway Postgres containers
  via Testcontainers, so they have no shared infrastructure dependency that would
  require serialisation.

The `playwright.config.ts` was updated to use `pnpm start` (pre-built production
server) in CI and `pnpm dev` (with `reuseExistingServer`) locally. A `concurrency`
block cancels in-progress runs on the same branch when a newer push arrives.

Failed e2e runs upload the Playwright HTML report as a CI artifact (7-day retention)
for trace and screenshot debugging without needing to re-run locally.

### Dependabot over alternatives

**Dependabot** was chosen over **Renovate** for automated dependency updates.

| Criteria | Dependabot | Renovate |
|---|---|---|
| Setup cost | Zero — native GitHub feature, single YAML file | Requires a separate config file + Renovate app install |
| Maintenance | Managed by GitHub; updates itself | Self-hosted or Renovate cloud; config can drift |
| PR noise | Grouping via `groups:` in v2 config | More granular control, but more config surface |
| Fit for project | Sufficient for a single-repo project with weekly cadence | Better suited to mono-repos or high-churn projects |

Configuration decisions:
- **npm**: weekly on Monday, max 5 open PRs, `chore:` commit prefix.
  All dev tooling (`@types/*`, `vitest`, `playwright`, `biome`, etc.) grouped into a
  single PR — these have no runtime impact and should not flood the inbox individually.
  Production dependencies (Next.js, Drizzle, next-auth, Recharts) get individual PRs
  so their changelogs are reviewed separately before merging.
- **github-actions**: weekly on Monday, `ci:` commit prefix, separate from npm PRs.

## Consequences

**Easier:**
- Accessibility and responsive regressions are caught in CI, not just locally.
- CI failure messages are precise — a lint failure doesn't hide a type error.
- Security patches and minor updates arrive automatically; the team reviews and merges
  rather than having to proactively check for updates.
- All checks start immediately on push — no waiting for an earlier stage to pass
  before slower checks begin, giving the shortest possible time-to-feedback.

**Harder:**
- The e2e job adds infrastructure complexity to CI: a Postgres service container,
  `pnpm build` before tests, and Playwright browser installation. If the CI
  environment changes (e.g. OS runner upgrades) this job is more likely to need
  maintenance than the simple Stage 1 jobs.
- Dummy OAuth credentials (`AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`) in the workflow
  file must remain as non-functional placeholders. Real credentials must never be
  committed — they belong in GitHub repository secrets.
- Dependabot PRs must still be reviewed and merged by a human. Grouping reduces
  volume but does not eliminate the review burden.

**Files changed by this ADR:**
- `.github/workflows/ci.yml` — rewritten with five fully parallel jobs (no `needs` dependencies)
- `.github/dependabot.yml` — new file
- `playwright.config.ts` — `webServer` updated to support both CI and local runs
- `docs/decisions/008-ci-pipeline-structure-and-dependabot.md` — this file
- `AGENTS.md` — updated to reflect new CI structure and add ADR trigger guidance

## Current implementation note (2026-03-02)

The decision remains accepted: CI still runs five parallel jobs and keeps
Dependabot as the dependency-update mechanism.

Current e2e implementation differs from some historical wording above:

- Local e2e startup now uses `pnpm dev:next` via
  `tests/e2e/setup/start-web-server.ts` (not `pnpm dev` with
  `reuseExistingServer`).
- `playwright.config.ts` currently sets `reuseExistingServer: false`.
- The e2e job does not use a GitHub Actions Postgres service container;
  Testcontainers starts `postgres:16-alpine` during the Playwright run.
