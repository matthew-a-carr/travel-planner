---
name: plan-feature
description: >
  Plan a new feature by writing a formal specification. Use when the user
  describes a feature idea, requests a new capability, or says "plan a feature."
  Researches the codebase, reviews tech debt, writes a structured spec from the
  project template, checks ADR triggers, and requests human approval before any
  implementation begins.
---

# Plan a Feature

## When to use

Use this skill when asked to plan, spec, or design a new feature. Do NOT use
for bug fixes, dependency bumps, documentation-only changes, or refactors with
no behaviour change.

## Pre-flight

1. Read `AGENTS.md` and `CONSTITUTION.md` to understand the engineering standards.
2. Read `docs/tech-debt.md` — check for outstanding items relevant to this feature.
   If any can be addressed alongside the new feature, note them for inclusion in
   the spec's implementation order.
3. Read `docs/specs/README.md` to determine the next spec number (SPEC-NNN).
4. **Check whether this feature is a slice of an epic.** If the user references
   an epic, or the work is one slice of a multi-SPEC initiative, read the
   parent epic file (`docs/epics/EPIC-NNN-*.md`) end-to-end. The epic's §10
   cross-cutting decisions are **inherited** — they are out of scope for
   re-grilling. The epic's §6 non-goals are also inherited. The slice you're
   planning must match a row in the epic's §7 slice table.
   - If the work *should* be an epic but no epic exists, **stop** and use
     `plan-epic` first.
   - If no epic applies (standalone feature), proceed; the spec's
     `Parent epic` field will be `—`.

## Grill the idea first

5. **Before writing the spec**, invoke the `grill-me` skill (vendored at
   `.agents/skills/grill-me/`) unless a `docs/specs/_draft-NNN-<slug>.md`
   brief already exists. That skill interviews the user one question at a
   time, walking down each branch of the design tree until shared
   understanding is reached.

   **If this slice has a parent epic**, scope the grilling to slice-level
   concerns: acceptance criteria, demo script, out-of-scope edges,
   prerequisites, security and observability for *this slice*, test
   strategy, implementation order. Do **not** re-grill the epic's
   cross-cutting decisions or non-goals — they're settled.
6. **When the grilling loop ends, this skill is responsible for writing the
   draft brief** — `grill-me` does not produce artefacts itself. Save it to
   `docs/specs/_draft-NNN-<slug>.md` (NNN = next free spec number; check
   `docs/specs/README.md`). Structure:

   ```markdown
   # Draft Brief — <Title>

   **Status:** Brief (pre-spec)
   **Will become:** SPEC-NNN

   ## Idea (one paragraph)
   ## Refined scope
   - In scope:
   - Out of scope (deliberately):
   - Out of scope (deferred):
   ## Acceptance signal
   ## Alternatives considered and rejected
   | Option | Why rejected |
   ## Open risks
   ## Key answers from grilling
   > Brief Q→A pairs that capture the most load-bearing decisions.
   ```

7. If a draft brief exists, read it end-to-end and treat its "Refined scope",
   "Acceptance signal", "Alternatives considered", and "Open risks" sections as
   inputs to the spec — do not silently re-litigate decisions captured there.
8. If anything in the brief is still genuinely unresolved, invoke `grill-me`
   again on just those items rather than guessing.

## Research

9. Identify which app the feature belongs to and which layers it touches:
   - `apps/web/` — read the relevant `AGENTS.md` for `domain/`,
     `application/`, `infrastructure/`, `ui/`, `app/`.
   - `apps/mobile/` — read that app's `AGENTS.md` once it exists (EPIC-001).
   - `packages/*` — read the package's README.
   - `infra/` — Terraform stack.
   If the feature is cross-app (e.g. a new REST endpoint consumed by both
   web and mobile), say so explicitly in the spec's summary.
10. Read existing related code to understand current patterns, types, and
    conventions.
11. Check existing ADRs in `docs/decisions/` for relevant prior decisions.
    If the spec has a parent epic, the epic's §10 cross-cutting decisions
    take precedence — do not contradict them silently.
12. Understand the acceptance criteria from the user's perspective — what
    does "done" look like to someone using the app?

## Write the spec

13. Copy `docs/specs/_template.md` → `docs/specs/SPEC-NNN-title.md`.
14. Set the `Parent epic` field at the top: link to the parent epic if any,
    or `—` for standalone specs.
15. Fill in **every** section of the template, using the draft brief from
    grilling as the source of truth for scope, acceptance, and rejected
    alternatives.
    - Use "N/A — [reason]" for sections that genuinely don't apply.
    - Acceptance criteria must be concrete and testable.
    - The demo script (§4) must walk through what you'd literally show a
      reviewer — not abstractions.
    - Out of scope (§5) carries equal weight to acceptance.
    - Implementation order (§12) pairs intent + verification per step, each
      step small enough to commit on its own, tests-first per CONSTITUTION
      §3.
16. Complete the ADR / tech-debt review (§13). If any trigger is met,
    draft the ADR alongside the spec.
17. Set status to `Draft`.

## Submit for review

18. Update `docs/specs/README.md` — add the new spec to the index table.
19. **If the spec has a parent epic**, update that epic's §7 slice table
    (the relevant row's "Becomes SPEC" cell → `SPEC-NNN (Draft)`) and
    append a row to its slice ledger.
20. Delete (or rename to `_draft-NNN-<slug>.superseded.md`) the draft brief
    now that the spec supersedes it.
21. Present the spec to the human for review.
22. **STOP. Do not begin implementation until the human sets status to
    `Approved`.**

## If changes are requested

23. Revise the spec based on human feedback.
24. If feedback exposes a new genuinely unresolved question, run another
    `grill-me` pass on just that question rather than guessing.
25. Re-submit for review.
26. Repeat until approved.
