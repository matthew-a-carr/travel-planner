# Triage a Security Update on a Dev-Only Transitive

## Problem/Feature Description

You are triaging Dependabot PRs in a Next.js + Expo monorepo that has documented
rules for how to handle dependency **security** updates — apply those rules
rather than reacting to the advisory generically.

Open PR:

- **#310** — a Dependabot **security** update bumping `esbuild` to patch a
  moderate-severity advisory. `esbuild` is pulled in only as a build/test-time
  transitive (via `drizzle-kit`); it is not part of the production runtime
  bundle.

## Output Specification

Produce a single file `security_triage.md` that states your recommendation for
#310 with reasoning, and briefly contrasts how you would treat the same advisory
if it were on a production runtime dependency instead.
