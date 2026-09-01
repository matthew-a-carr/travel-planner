# ADR 068: Dependabot — Split Major Updates from Minor/Patch

**Date:** 2026-09-01
**Status:** Accepted

## Context

[ADR 067](067-dependabot-single-pr-per-ecosystem.md) grouped every update
type — major, minor, and patch — into one `all-dependencies` PR per
ecosystem. The first grouped npm PR under that scheme (#195, 29 updates)
proved the predicted risk: it bundled `ai` 6→7 and `@ai-sdk/react` 3→4 with
27 unrelated minor/patch bumps. The `ai` v7 major changed the
`ToolExecutionOptions` shape, breaking `src/infrastructure/ai/chat-tools.ts`
and its tests (`TS2345` on every call site) — a real, CI-confirmed build
failure, not a false alarm. Because everything shared one PR, the 27 safe
updates (next, sentry, playwright, vitest, biome, testcontainers, ...)
were stuck behind that one breaking major with no way to land independently
short of hand-editing the generated diff.

## Decision

Split each ecosystem's single group into two: `minor-and-patch` (any
package, `update-types: [minor, patch]`) and `major` (any package,
`update-types: [major]`). Both still group everything of that type into one
PR — the batching ADR 067 wanted — but a major can no longer block a minor
or patch from merging. The `ignore:` holds (Expo SDK set, `react`, `jest`,
TypeScript 6 / Vite 8 majors) are unchanged.

Net effect: up to two open PRs per ecosystem (minor/patch, major) instead
of one — still far fewer than pre-ADR-067's one-PR-per-major-bump, while
majors can no longer hold routine updates hostage.

## Consequences

- Minor/patch PRs stay fast-moving and low-risk to merge on green CI.
- A major-only group PR is still multiple packages bundled together (e.g.
  a future PR could combine two unrelated majors) — reviewing it still
  means reading each package's changelog individually per the
  `triage-dependabot` skill's "never auto-merge majors" rule. This ADR
  narrows the blast radius to "majors only," it doesn't eliminate the
  need for judgment on that group.
- Does not by itself fix the `ai` v7 break — PR #195 (or whatever replaces
  it under the new grouping) still needs the `chat-tools.ts` migration to
  the v7 `ToolExecutionOptions` shape before it can merge.
