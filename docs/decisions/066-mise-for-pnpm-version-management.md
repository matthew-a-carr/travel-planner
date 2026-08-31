# ADR 066: Mise for pnpm Version Management

**Date:** 2026-08-31
**Status:** Accepted

## Context

The pnpm version was pinned in three unrelated places that could drift
independently: CI hardcoded `version: 10` in eight `pnpm/action-setup`
steps in `.github/workflows/ci.yml`, `.claude/hooks/session-start.sh`
assumed pnpm was already on `PATH` for remote Claude Code sessions
(inherited from the base image, un-pinned), and local developer machines
installed pnpm however they liked (`npm install -g pnpm`, corepack,
Homebrew, ...). Nothing enforced these matched — investigating this change
found local pnpm at 11.25.0 against CI's pinned major version 10, an
unnoticed drift.

There was no `packageManager` field in `package.json` and no
`.tool-versions` / `mise.toml` — no single source of truth for the pnpm
version at all.

## Decision

Adopt [mise](https://mise.jdx.dev) as the single source of truth for the
pnpm version, declared in `mise.toml` at the repo root (`pnpm = "10"`,
matching the precision CI already used).

- CI: replace all eight `pnpm/action-setup@v6` steps in `ci.yml` with
  `jdx/mise-action@v2`, which installs the pnpm version from `mise.toml`
  before `actions/setup-node@v6`'s pnpm cache step runs.
- Remote sessions: `.claude/hooks/session-start.sh` installs mise (if
  missing) and runs `mise install pnpm` before `pnpm install`, so cloud
  sessions get the pinned version rather than whatever the base image
  happens to ship.
- Local dev: `README.md` documents `mise install` as the recommended path,
  with manual pnpm install kept as a documented fallback for contributors
  who don't want another tool.

Scope is deliberately narrow: only pnpm's version is mise-managed. Node
stays on `actions/setup-node` / whatever's on a developer's machine — it
wasn't drifting and expanding scope to Node wasn't asked for.

## Consequences

- One file (`mise.toml`) is now the only place the pnpm version is
  declared; bumping it updates CI, remote sessions, and any local
  contributor who runs `mise install` uniformly.
- Adds a new external tool (mise) and a new GitHub Action
  (`jdx/mise-action`) to the toolchain surface.
- Contributors who don't install mise still work — pnpm just needs to be
  on `PATH` themselves, matching pre-ADR behaviour.
- The pre-existing pnpm 10 vs. 11 drift between CI and local machines is
  now visible and enforced away rather than silently possible.
