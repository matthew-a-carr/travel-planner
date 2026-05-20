# ADR 047: Specification-Driven AI Development Lifecycle

**Date:** 2026-05-20
**Status:** Accepted

## Context

The travel-planner project is designed to be worked on by human engineers and AI
agents interchangeably (CONSTITUTION.md §1). The existing harness — layer
boundaries, TDD, CI gates, ADRs — enforces correctness at implementation time.
However, there is no structured process for the **upstream planning phase**: going
from an idea to a formal, implementable specification.

Without a repeatable specification step:

- AI agents jump straight to implementation without a shared understanding of
  scope, acceptance criteria, or domain design.
- Deviations from the original intent are invisible — there is no record of what
  changed during implementation or why.
- Technical debt accumulates silently with no central register or review cadence.
- The process is not repeatable — each feature follows a slightly different
  planning approach (ad-hoc conversation, Claude plans, iOS planning doc, ADR
  slices) with no consistent structure.

## Decision

Introduce a **specification-driven development lifecycle** with three new
artefacts:

1. **Feature Specs** (`docs/specs/SPEC-NNN-title.md`) — formal, structured
   specifications using a mandatory template (`docs/specs/_template.md`). Every
   non-trivial feature starts with a spec that covers: acceptance criteria,
   domain design, application layer, infrastructure, UI/UX, test plan, and
   implementation order.

2. **Implementation Deviations** — a table embedded in each spec where the
   implementing agent documents anything that didn't go according to plan during
   implementation.

3. **Tech Debt Register** (`docs/tech-debt.md`) — a cumulative, cross-cutting
   register where unresolved deviations are promoted. Reviewed before planning
   new specs and periodically for debt paydown.

The lifecycle has explicit human gates:

- Specs must be **approved by a human** before implementation begins.
- Agents must **consult the human** when unsure during implementation.
- The human does a **final review** of the completed implementation.

Verification uses the existing CI infrastructure — no new tooling is introduced.
The full verification suite (`pnpm lint && pnpm db:check:migrations && pnpm
type-check && pnpm test:unit && pnpm test:integration`) must pass before a spec
is marked Complete.

Specs integrate with the existing ADR system: each spec template includes an
ADR trigger checklist so the planning agent always considers whether an ADR is
needed alongside the spec.

## Consequences

**What becomes easier:**

- AI agents have a clear, repeatable process to follow from idea to verified
  implementation.
- Deviations are tracked and visible, preventing silent drift from design intent.
- Tech debt has a single source of truth that can be reviewed and prioritised.
- The spec serves as documentation for future maintainers — the "why" and "what"
  alongside the code's "how."
- Human oversight is built into the process at defined gates.

**What becomes harder:**

- There is more up-front ceremony for each feature. Simple features that don't
  warrant a spec should use the existing lightweight process (the spec trigger
  criteria in AGENTS.md define when a spec is and isn't needed).
- The tech debt register requires discipline to maintain. Without periodic
  review, it risks becoming stale.
- Spec numbering requires coordination if multiple agents/humans create specs
  concurrently (same risk as ADR numbering — manageable in practice).

**Trade-offs:**

- Specs live in the repo (not in an external tool). This keeps them versioned
  and accessible to agents but means they're not queryable via a project
  management tool. Jira tickets can link to specs for cross-referencing.
- The deviation log is intentionally embedded in the spec (not in a separate
  file) so that the full story of a feature — plan, implementation, and
  learnings — lives in one place.
