# Triage a Security Update on a Dev-Only Transitive

## Problem/Feature Description

You are triaging Dependabot PRs in a Next.js + Expo monorepo. The repo's
tech-debt register (TD-005) records that certain **dev-only transitive**
dependencies carry security advisories but have **no production runtime impact**
because they are build/test-time only — for example `esbuild` pulled in via
`drizzle-kit`, and `@tootallnate/once` pulled in via `vitest` → `jsdom`. The
documented plan is to **bundle** these dev-only security bumps per the tech-debt
plan rather than firefight them one at a time. A security advisory on a
**production** dependency is the exception and should be prioritised (escalated
if it requires a major).

Open PR:

- **#310** — a Dependabot **security** update bumping `esbuild` (a dev-only
  transitive via `drizzle-kit`) to patch a moderate-severity advisory. The
  package is used only at build time; it is not in the production runtime bundle.

## Output Specification

Produce a single file `security_triage.md` that states your recommendation for
#310 and the reasoning, and briefly contrasts how you would treat the same
advisory if it were on a **production** runtime dependency instead.
