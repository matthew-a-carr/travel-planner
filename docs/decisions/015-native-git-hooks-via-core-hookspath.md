# ADR 015: Native Git Hooks via `core.hooksPath`

**Date:** 2026-03-01
**Status:** Superseded by ADR 033

> **Note:** The pre-push hook described below has been removed. The `core.hooksPath`
> mechanism and the pre-commit hook (Terraform formatting) remain active.

## Context

The repository enforces a pre-push feedback loop (`lint`, `type-check`, unit
and integration tests) before code leaves a developer machine. We need this
hook behavior to be reliable, easy to understand, and low-maintenance.

Two approaches were available:

- use native Git hooks committed in-repo and activated with
  `git config core.hooksPath .githooks`
- introduce a hook manager dependency (for example Husky or Lefthook)

Given the project’s current needs, a dependency-backed hook manager would add
extra setup and configuration surface without introducing capabilities we
currently require.

## Decision

Use native Git hooks with a repository-scoped hooks path.

- Store hook scripts in `.githooks/`.
- Configure installation through the package lifecycle:
  `prepare: git config core.hooksPath .githooks`.
- Keep the pre-push implementation as a plain shell script
  (`.githooks/pre-push`) that runs the required checks in sequence.
- Do not add Husky or Lefthook at this stage.

## Consequences

- The hook system has no extra runtime dependency and remains transparent to
  contributors (`.githooks/pre-push` is the single source of behavior).
- Setup stays simple: `pnpm install` is sufficient to activate hooks for that
  local clone.
- Hook behavior is portable across environments that already have Git and shell
  support.
- We do not get framework features from Husky/Lefthook (for example richer hook
  orchestration or plugin ecosystems). If future needs justify those features,
  this decision can be superseded by a new ADR.
