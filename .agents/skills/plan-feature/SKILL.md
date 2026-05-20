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

## Research

4. Identify which layers of the codebase are affected:
   - Domain (`apps/web/src/domain/`) — read the layer's `AGENTS.md`
   - Application (`apps/web/src/application/`) — read the layer's `AGENTS.md`
   - Infrastructure (`apps/web/src/infrastructure/`) — read the layer's `AGENTS.md`
   - UI (`apps/web/src/ui/`) and App (`apps/web/src/app/`)
5. Read existing related code to understand current patterns, types, and conventions.
6. Check existing ADRs in `docs/decisions/` for relevant prior decisions.
7. Understand the acceptance criteria from the user's perspective — what does "done"
   look like to someone using the app?

## Write the spec

8. Copy `docs/specs/_template.md` → `docs/specs/SPEC-NNN-title.md`.
9. Fill in **every** section of the template:
   - Use "N/A — [reason]" for sections that don't apply.
   - Acceptance criteria must be concrete and testable (Given/When/Then).
   - Implementation order must be a sequence of committable steps, each following
     the TDD workflow (tests first, then minimum implementation).
   - Each step should reference the commit message it will produce.
10. Complete the "ADR Required?" checklist (section 10). If any trigger is met,
    draft the ADR alongside the spec.
11. Set status to `Draft`.

## Submit for review

12. Update `docs/specs/README.md` — add the new spec to the index table.
13. Present the spec to the human for review.
14. **STOP. Do not begin implementation until the human sets status to `Approved`.**

## If changes are requested

15. Revise the spec based on human feedback.
16. Re-submit for review.
17. Repeat until approved.
