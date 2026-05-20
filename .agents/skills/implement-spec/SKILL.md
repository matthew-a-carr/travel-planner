---
name: implement-spec
description: >
  Implement an approved feature specification. Use when the user says "implement
  SPEC-NNN," "build the feature in SPEC-NNN," or references an approved spec.
  Follows the spec's implementation order using TDD, logs deviations, runs the
  full verification suite, and closes out the spec with post-implementation notes
  and tech debt capture.
---

# Implement a Spec

## When to use

Use this skill when asked to implement an approved spec from `docs/specs/`.
The spec must have status `Approved` before implementation begins.

## Pre-flight

1. Read the spec file (`docs/specs/SPEC-NNN-title.md`) end-to-end.
2. **Verify status is `Approved`.** If not, STOP — do not implement unapproved specs.
3. Read `AGENTS.md` and `CONSTITUTION.md` to confirm current engineering standards.
4. Read the layer-specific `AGENTS.md` files for any layers this spec touches.
5. Set the spec status to `In Progress`.

## Implement

6. Follow the spec's **Implementation Order** (section 9), step by step.
7. For each step, follow the TDD workflow from CONSTITUTION.md §3:
   a. Write the failing test first (e2e, unit, or integration as appropriate).
   b. Implement the minimum code to make the test pass.
   c. Refactor if needed, keeping all tests green.
   d. Commit with a Conventional Commit message matching the spec's suggested message.

## Track deviations

8. **After each step**, check: did anything differ from what the spec described?
   - A type signature that needed to change?
   - An edge case the spec didn't anticipate?
   - A step that was harder or easier than expected?
   - Scope that was cut or added?
9. If yes, add a row to the spec's **Implementation Deviations** table:
   ```
   | # | Deviation | Reason | Impact | Resolved? |
   ```
10. If a deviation is significant or you're unsure of the right approach:
    **STOP and consult the human.** Do not guess on important design decisions.
11. If a deviation creates tech debt that can't be resolved now, add it to
    `docs/tech-debt.md` with severity and a cross-reference to the spec (e.g. `TD-NNN`).

## Verify

12. Run the full verification suite:
    ```bash
    pnpm lint && pnpm db:check:migrations && pnpm type-check && pnpm test:unit && pnpm test:integration
    ```
13. If any check fails, fix it before proceeding. If stuck, consult the human.
14. Run e2e tests if the spec includes e2e acceptance criteria:
    ```bash
    pnpm test:e2e
    ```
15. Verify the production build:
    ```bash
    POSTGRES_URL=postgresql://build:build@localhost:5432/build pnpm build
    ```

## Close out

16. Update the spec status → `Complete`.
17. Write **Post-Implementation Notes** in the spec — what you learned, what was
    surprising, what you'd do differently.
18. Move any unresolved deviations to `docs/tech-debt.md`.
19. Update `CHANGELOG.md` under `## [Unreleased]` if user-facing changes were made.
20. Review the doc review table in `AGENTS.md` — update any docs that are now stale.
21. Update `docs/specs/README.md` index with the new status.
22. Present the completed work to the human for final review.
