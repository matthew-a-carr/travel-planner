# ADR 067: Dependabot — One Grouped PR Per Ecosystem, Including Majors

**Date:** 2026-08-31
**Status:** Accepted

## Context

`.github/dependabot.yml` grouped minor and patch updates into one PR per
ecosystem but left major-version updates ungrouped, so each major bump
opened its own individual PR. With npm + github-actions both raising
majors periodically, this could mean several open Dependabot PRs to
review at once, on top of the two grouped minor/patch PRs.

Dependabot cannot merge updates from different `package-ecosystem` blocks
into a single PR — npm and github-actions are always separate PR streams.
The most consolidation available within one ecosystem is one group
containing every update type.

## Decision

Change both ecosystem groups (`npm`, `github-actions`) from filtering to
`minor`/`patch` only to grouping every update type — major included — into
a single `all-dependencies` group per ecosystem. The existing `ignore:`
list (Expo-SDK-managed deps, `react`/`@types/react`, `jest`/`@types/jest`,
and the TypeScript 6 / Vite 8 major-only holds) is unchanged: those
dependencies are excluded from updates entirely regardless of grouping, so
this doesn't reopen TD-006/TD-007/TD-009 or the other held pins.

Net effect: at most one open Dependabot PR per ecosystem (two total) at
any time, instead of one grouped PR plus N individual major PRs.

## Consequences

- Fewer open PRs to triage — the explicit goal.
- A single PR can now bundle an unrelated major-version breaking change
  with routine minor/patch bumps. If a major update in the group needs
  more careful review or a revert, the whole PR is affected, not just that
  one dependency — `triage-dependabot` / `dependency-review` should watch
  for this when reviewing the grouped PR's release notes.
- Held dependencies are unaffected — they still don't appear in Dependabot
  PRs until the hold is lifted.
