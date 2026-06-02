---
name: write-adr
description: >
  Write a new Architecture Decision Record following CONSTITUTION §7, wire it
  into the `docs/decisions/README.md` index, and update the status lines of any
  ADR it supersedes. Use when a change meets an ADR trigger in AGENTS.md ("When
  to write an ADR"), when a human says "write an ADR for X", or when called by
  `implement-spec` / `draft-spec` at the point a decision is made. Edits files —
  it creates the ADR and the index row in the same change as the code it documents.
---

# Write an ADR

## When to use

An ADR records a **decision**, in the same commit/branch as the change that
embodies it. Use this skill when:

- A routine (`implement-spec`, `draft-spec`) reaches a decision that meets an
  AGENTS.md "When to write an ADR" trigger.
- A human asks "write an ADR for X".

## Step 0 — Confirm an ADR is actually warranted

Read the "When to write an ADR" section of `AGENTS.md`. Write one when the
change does any of:

- Chooses a library or external tool.
- Changes CI pipeline structure (stages, jobs, parallelism, service containers).
- Adds/changes a dependency-management tool or policy.
- Establishes a project-wide standard (accessibility target, breakpoints, …).
- Changes the database schema strategy (migrations vs push, seed approach).
- Makes a non-obvious architectural trade-off in any layer.

Do **not** write one for: a bug fix with no design decision, a routine version
bump, or a test that follows an established pattern. If none of the triggers
fit, say so and stop — a noise ADR violates CONSTITUTION §9 ("ADRs capture
*decisions*, not implementation notes"). When genuinely unsure, AGENTS.md says
err toward writing one; the cost of an unnecessary ADR is low.

## Step 1 — Allocate the number

1. Read `docs/decisions/README.md` and `ls docs/decisions/`. The next number
   is `highest + 1`, zero-padded to three digits (`NNN`). If two ADRs are in
   flight on different branches they may collide — if your number already
   exists on `main`, take the next free one and renumber your file.

## Step 2 — Name the file

2. Filename: `NNN-short-descriptive-title.md`. The title must convey the
   subject **from the filename alone** (CONSTITUTION §7) — `038-money-result-
   and-unchecked-constructors.md`, not `038-domain-changes.md`. kebab-case.

## Step 3 — Write the record

3. Copy `docs/decisions/000-template.md` → `docs/decisions/NNN-title.md` and
   fill it in:

   ```markdown
   # ADR NNN: Title

   **Date:** YYYY-MM-DD   ← today, absolute (resolve relative dates)
   **Status:** Accepted

   ## Context
   Why this decision needs to be made — the problem or situation.

   ## Decision
   What was decided. State the chosen design as a fact, not a deliberation.

   ## Consequences
   The trade-offs. What becomes easier or harder. Name what you gave up.
   ```

   - **Status:** use `Accepted` when the ADR ships alongside the implementing
     change (the common case). Use `Proposed` only when recording a decision
     for review *before* acting on it.
   - Keep it concise (CONSTITUTION §9). Three short sections beat an essay.
   - If you rejected serious alternatives, a short "Alternatives considered"
     subsection under Decision is fine — but the chosen design is stated as a
     fact, not interleaved with the paths not taken.

## Step 4 — Handle supersession

4. If this ADR replaces or narrows an earlier one:
   - In the **old** ADR, change its `**Status:**` line to
     `Superseded by [ADR NNN](NNN-title.md)` (or `Partially superseded by
     [ADR NNN](NNN-title.md)` if only part is replaced).
   - In the **new** ADR's Context, name the ADR it supersedes and why.

## Step 5 — Update the index and cross-references

5. Update the `docs/decisions/README.md` index table:
   - Add a row in number order: `| [NNN](NNN-title.md) | Title | YYYY-MM-DD | Status |`.
   - Update the Status cell of any ADR you superseded in Step 4.
6. Run the rest of the doc-staleness sweep via `sync-docs` (or apply the
   `AGENTS.md` doc-review row "ADR files … add/rename/status" by hand): fix any
   ADR cross-references in `AGENTS.md` / `README.md` / the CONSTITUTION
   enforcement map that this decision changes.

## Step 6 — Commit with the change

7. The ADR belongs in the **same commit (or at least the same branch/PR)** as
   the code or config it documents — not a follow-up. Commit message:
   `docs(adr-NNN): <decision>` (or fold it into the feature commit).

## Do not

- Do **not** write an ADR for a change that meets no trigger — stop and say so.
- Do **not** add the file without the `README.md` index row (the index is the
  discovery path; a missing row is the most common staleness bug here).
- Do **not** leave a superseded ADR's status line stale — a reader who lands on
  the old ADR must be routed to the new one.
- Do **not** restate implementation detail that belongs in the code or the
  implementation-notes file. Capture the *decision*.
