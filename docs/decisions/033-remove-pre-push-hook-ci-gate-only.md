# ADR 033: Remove Pre-Push Hook — CI as the Only Hard Gate

**Date:** 2026-03-14
**Status:** Accepted

## Context

ADR 015 introduced a native pre-push hook (`.githooks/pre-push`) that runs
lint, type-check, unit tests, and integration tests before every `git push`.
At the time this was a lightweight safety net for a small codebase.

As the codebase has grown, the hook adds increasing friction:

- The full check suite now takes meaningfully longer, discouraging frequent
  small pushes and slowing down the commit-early-commit-often workflow.
- CI already runs every one of the same checks (plus e2e and the production
  build) on every push and every PR. The hook duplicates effort without adding
  a gate that CI does not already provide.
- Contributors bypass the hook (`--no-verify`) when the wait becomes
  impractical, which undermines its purpose.

The pre-commit hook (`.githooks/pre-commit` — Terraform formatting) is
lightweight and remains unaffected by this change.

## Decision

Remove `.githooks/pre-push`. CI (`.github/workflows/ci.yml`) becomes the sole
automated enforcement gate.

Replace the hook with documented, change-aware manual verification guidance in
`AGENTS.md` so that agents and contributors know *which* checks to run based on
*what they changed* — without being forced to run the entire suite on every
push.

The `core.hooksPath` mechanism and prepare script remain because the
pre-commit hook still uses them.

## Consequences

- Local pushes are no longer blocked by a slow check suite, reducing friction
  and encouraging smaller, more frequent commits.
- Contributors and agents are expected to run relevant checks manually before
  pushing, guided by the verification table in `AGENTS.md`. This is a
  discipline-based rather than enforcement-based approach for local work.
- CI remains the hard gate — `main` is still protected. No code merges unless
  all CI jobs pass.
- There is a slightly wider window for broken pushes to reach the remote, but
  CI will catch them before merge. The trade-off is acceptable given the speed
  of the CI pipeline.
- ADR 015 is superseded for the pre-push hook aspect; its `core.hooksPath`
  pattern continues to serve the pre-commit hook.
