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
3. **Invoke the `review-spec` skill** as a final gate. The spec may have
   been approved before later ADRs, epic changes, or tech debt entries
   landed. Refuse to start if the verdict is **Needs revision** or
   **Blocked** — return to the human with the report; do not proceed and
   do not silently patch the spec. Warnings can be acknowledged inline in
   the implementation notes file rather than blocking.
4. Read `AGENTS.md` and `CONSTITUTION.md` to confirm current engineering standards.
5. Read the layer-specific `AGENTS.md` files for any layers this spec touches.
6. Set the spec status to `In Progress`.
7. **Open the implementation notes file.** Copy
   `docs/implementation-notes/_template.md` →
   `docs/implementation-notes/SPEC-NNN-<slug>.md`. Fill in the header (spec
   link, start date). Leave the entries list empty — you'll append to it as
   you work. This file is your rolling log; keep it open in a tab.

## Implement

6. Follow the spec's **Implementation Order** (section 9), step by step.
7. For each step, follow the TDD workflow from CONSTITUTION.md §3:
   a. Write the failing test first (e2e, unit, or integration as appropriate).
   b. Implement the minimum code to make the test pass.
   c. Refactor if needed, keeping all tests green.
   d. Commit with a Conventional Commit message matching the spec's suggested message.

## Track deviations — capture first, triage later

The rule: **capture cheap, triage deliberate.** While implementing, append to
the notes file the moment something is off-script. Don't context-switch into
the structured spec tables mid-flight — that gets skipped under pressure and
is where deviation logs go to die.

8. **As you work**, append an entry to `docs/implementation-notes/SPEC-NNN-<slug>.md`
   any time:
   - The code needed to differ from what the spec described (type signature,
     domain shape, schema, etc.).
   - An edge case appeared the spec didn't anticipate.
   - A step was meaningfully harder or easier than expected.
   - You cut or added scope.
   - You made a small judgment call that a reader might later want to know about.
   - A test surfaced a surprising existing behaviour.

   One entry per observation. Use the timestamped format from the template.
   Leave the "Triage" line blank — that's filled at close-out.

9. If a deviation is significant or you're unsure of the right approach:
   **STOP and consult the human.** Do not guess on important design decisions.
   Log the consultation and its outcome in the notes file.

10. The spec's **Implementation Deviations** table and `docs/tech-debt.md`
    are **not** updated mid-flight — they're filled at close-out from the notes
    file. The one exception: if a deviation creates an immediate
    cross-cutting hazard (security, data loss, broken invariant) that another
    contributor must know about *today*, add it to `docs/tech-debt.md`
    straight away with severity and a back-reference to the notes entry.

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

## Close out — triage the notes file

This is the deliberate synthesis step the rolling log is designed for.

16. Open `docs/implementation-notes/SPEC-NNN-<slug>.md`. For **every** entry,
    pick one of the four landing places and fill in the "Triage" line:

    | Landing place | When to use |
    |---------------|-------------|
    | Spec's **Implementation Deviations** table | Anything that changed the design intent vs. the approved spec. |
    | Spec's **Post-Implementation Notes** | Learnings, surprises, would-do-differently — not deviations. |
    | `docs/tech-debt.md` (new TD-NNN row) | Unresolved debt that must outlive this spec. Cross-reference the spec and the notes entry. |
    | Discarded | Resolved during implementation; no future reader needs it. Say so explicitly — don't leave entries un-triaged. |

17. Fill in the "Close-out triage summary" table at the bottom of the notes
    file so a reader can scan the whole disposition in one place.

18. Update the spec:
    - Status → `Complete`.
    - Implementation Deviations table populated from triage.
    - Post-Implementation Notes section written.

19. Update `CHANGELOG.md` under `## [Unreleased]` if user-facing changes were made.
20. Review the doc review table in `AGENTS.md` — update any docs that are now stale.
21. Update `docs/specs/README.md` index with the new status.
22. Leave the notes file in place — it's the raw record. Do not delete it.
23. **Delete the draft brief.** Remove `docs/specs/_draft-NNN-<slug>.md`
    if it still exists. The SPEC itself is now the authoritative record;
    git history preserves the brief. (Same rule applies if a spec is
    being marked `Abandoned` rather than `Complete`.)
24. Present the completed work to the human for final review.
