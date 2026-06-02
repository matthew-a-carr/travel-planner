---
name: sync-docs
description: >
  Diff-driven doc-staleness sweep. Maps every changed path against the "Doc
  review — keeping docs true" table in AGENTS.md, runs the load-bearing
  generated-artifact checks (OpenAPI, AGENTS.md/CLAUDE.md symlinks, ADR index),
  and patches stale prose docs in the same change. Use when called by
  `implement-spec` / `review-implementation` at close-out, or when a human says
  "sync the docs" / "make sure the docs are still true after this change".
---

# Sync Docs to the Diff

## When to use

Docs go stale when code changes but the surrounding description doesn't. This
skill turns the `AGENTS.md` "Doc review — keeping docs true" table from a thing
you're *supposed* to remember into a deterministic sweep over the actual diff.

Use it:

- As a close-out step inside `implement-spec` (replaces "eyeball the doc-review
  table").
- As Pass 6 of `review-implementation` (report-only there).
- Interactively: "sync the docs", "did this change leave any docs stale?".

## Mode

- **Patch mode** (default, when invoked by `implement-spec` or a human fixing
  their own change): read the flagged docs and patch the stale parts in the
  same change. Match each doc's existing style and density (Rule 3, Rule 8).
- **Report mode** (when invoked by `review-implementation`, or when the right
  fix isn't obvious): list what's stale and what's missing; do not edit. Never
  silently skip a flagged doc — an un-checked row is a Rule 9 failure.

## Step 1 — Get the diff

1. Determine the changed paths:
   - Local working change: `git diff --name-only` (+ `--staged`).
   - A branch/PR: `git diff main...HEAD --name-only`.
   Keep the full diff handy too — you need *what* changed, not just *which file*.

## Step 2 — Load the authoritative mapping

2. Read the **"Doc review — keeping docs true"** table in `AGENTS.md`. That
   table is the source of truth for "you changed X → check doc Y". **Do not
   hardcode a copy of it here** — read it at run time so this skill can't drift
   from it. (If you ever find the table missing a mapping that clearly should
   exist, flag it; don't silently invent the rule.)

## Step 3 — Run the load-bearing generated-artifact checks

These are deterministic — run the command, don't eyeball. Any failure here is a
hard miss:

3. **OpenAPI** — if the diff touches a `@travel-planner/shared` wire schema or
   any `/api/v1/*` request/response/error shape (or `apps/web/scripts/
   generate-openapi.ts`): run `pnpm openapi:check`. If it fails, run
   `pnpm openapi:generate` and stage `docs/openapi/v1.yaml`. New endpoints must
   be wired into the generator's `paths`/registry (ADR 056 / SPEC-008). Report
   mode: just report the `openapi:check` exit status.
4. **AGENTS.md / CLAUDE.md symlinks** — if the diff adds any new `AGENTS.md`,
   verify a sibling `CLAUDE.md` symlink exists (`ls -la <dir>/CLAUDE.md`). If
   not, create it: `ln -s AGENTS.md CLAUDE.md` in that directory.
5. **ADR index** — if the diff adds/renames/changes the status of any
   `docs/decisions/*.md`, verify `docs/decisions/README.md` has the matching
   index row and that superseded ADRs' status lines were updated. (Writing a
   new ADR is `write-adr`'s job — here just confirm the index is consistent.)
6. **CHANGELOG** — if the diff is user-facing, verify `CHANGELOG.md` has an
   entry under `## [Unreleased]`.

## Step 4 — Check the prose docs the table flagged

7. For every other row matched in Step 2, open the named doc and check the
   specific claim the change might have falsified. The `AGENTS.md` "Signs a doc
   is stale" heuristics:
   - It describes a tool, file, command, or behaviour that no longer exists.
   - It omits a key file or command that now does exist.
   - Its prerequisites or setup steps no longer work end-to-end.
8. Patch mode: fix the stale passage, nothing more (Rule 3 — don't "improve"
   adjacent prose). Report mode: quote the stale line and say what's now true.

## Step 5 — Report

9. Output the report using **exactly** this structure — these headings
   verbatim, the real path count substituted into the `##` heading, the diff
   command you ran on the record, and no renamed/added/dropped sections:

   ```markdown
   ## Doc sync — <N> paths changed

   _Diff: `git diff --staged --name-only` (or `git diff main...HEAD --name-only`)_

   ### Generated artifacts
   - OpenAPI: regenerated docs/openapi/v1.yaml | clean | n/a
   - Symlinks: <result> | n/a
   - ADR index: <result> | n/a
   - CHANGELOG: <result> | n/a

   ### Prose docs
   - <doc> — patched: <one line> | stale, needs <X> | clean

   ### Unresolved (couldn't fix safely)
   - <doc> — <why, what's needed>
   ```

   If everything was already true, keep the headings and say so explicitly under
   each ("all matched rows already accurate") — silence reads as "didn't check".

## Do not

- Do **not** edit code, only docs (and generated artifacts via their generator).
- Do **not** regenerate `docs/openapi/v1.yaml` by hand — only via
  `pnpm openapi:generate`.
- Do **not** touch docs the diff didn't implicate. Scope is the changed paths.
- Do **not** report "docs clean" without having run Step 3's commands.
