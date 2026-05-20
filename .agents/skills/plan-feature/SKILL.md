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

## Grill the idea first

4. **Before writing the spec**, invoke the `grill-me` skill (vendored at
   `.agents/skills/grill-me/`) unless a `docs/specs/_draft-NNN-<slug>.md`
   brief already exists. That skill interviews the user one question at a
   time, walking down each branch of the design tree until shared
   understanding is reached.
5. **When the grilling loop ends, this skill is responsible for writing the
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

6. If a draft brief exists, read it end-to-end and treat its "Refined scope",
   "Acceptance signal", "Alternatives considered", and "Open risks" sections as
   inputs to the spec — do not silently re-litigate decisions captured there.
7. If anything in the brief is still genuinely unresolved, invoke `grill-me`
   again on just those items rather than guessing.

## Research

7. Identify which app the feature belongs to (`apps/web/`, future `apps/ios/`,
   shared `packages/`) and which layers it touches. For the Next.js app, those
   layers are:
   - Domain (`apps/web/src/domain/`) — read the layer's `AGENTS.md`
   - Application (`apps/web/src/application/`) — read the layer's `AGENTS.md`
   - Infrastructure (`apps/web/src/infrastructure/`) — read the layer's `AGENTS.md`
   - UI (`apps/web/src/ui/`) and App (`apps/web/src/app/`)
   For other apps (e.g. iOS — ADR 045), read that app's own `AGENTS.md` once it
   exists. If the feature is cross-app (e.g. a new REST endpoint consumed by both
   web and iOS), say so explicitly in the spec's summary.
8. Read existing related code to understand current patterns, types, and conventions.
9. Check existing ADRs in `docs/decisions/` for relevant prior decisions.
10. Understand the acceptance criteria from the user's perspective — what does "done"
    look like to someone using the app?

## Write the spec

11. Copy `docs/specs/_template.md` → `docs/specs/SPEC-NNN-title.md`.
12. Fill in **every** section of the template, using the draft brief from
    grilling as the source of truth for scope, acceptance signals, and rejected
    alternatives.
    - Use "N/A — [reason]" for sections that don't apply.
    - Acceptance criteria must be concrete and testable (Given/When/Then).
    - Implementation order must be a sequence of committable steps, each following
      the TDD workflow (tests first, then minimum implementation).
    - Each step should reference the commit message it will produce.
13. Complete the "ADR Required?" checklist (section 10). If any trigger is met,
    draft the ADR alongside the spec.
14. Set status to `Draft`.

## Submit for review

15. Update `docs/specs/README.md` — add the new spec to the index table.
16. Delete (or rename to `_draft-NNN-<slug>.superseded.md`) the draft brief
    now that the spec supersedes it.
17. Present the spec to the human for review.
18. **STOP. Do not begin implementation until the human sets status to `Approved`.**

## If changes are requested

19. Revise the spec based on human feedback.
20. If feedback exposes a new genuinely unresolved question, run another
    `grill-me` pass on just that question rather than guessing.
21. Re-submit for review.
22. Repeat until approved.
