# SPEC-NNN: [Feature Title]

**Date:** YYYY-MM-DD
**Status:** Draft | Approved | In Progress | Complete | Abandoned
**Author:** [human / agent name]
**Approved by:** [human name + date, or "—" if not yet approved]

## 1. Summary

One-paragraph description of what this feature does from the user's perspective.

## 2. Motivation

Why does this feature exist? What problem does it solve? Link to any Jira tickets,
user feedback, or product goals.

## 3. Acceptance Criteria

Numbered list of observable behaviours that define "done." These map directly
to e2e tests.

1. Given [context], when [action], then [expected outcome].
2. ...

## 4. Domain Design

### New/Modified Entities & Value Objects

| Entity/VO | Layer | File | Change |
|-----------|-------|------|--------|
| ... | domain | src/domain/... | New / Modified |

### New/Modified Domain Functions

| Function | Purpose | Returns |
|----------|---------|---------|
| ... | ... | Result<T, E> |

### Invariants

- List domain invariants this feature introduces or modifies.

## 5. Application Layer

### Use Cases

| Use Case | Input | Output | Side Effects |
|----------|-------|--------|--------------|
| ... | ... | Result<T, E> | ... |

### Repository Interface Changes

| Repository | Method | Signature |
|------------|--------|-----------|
| ... | ... | ... |

## 6. Infrastructure

### Database Schema Changes

Describe table/column changes. Include a migration plan if schema changes
are non-trivial.

### External Service Integration

Any new external APIs, providers, or services.

## 7. UI/UX

### Routes & Pages

| Route | Purpose |
|-------|---------|
| ... | ... |

### Components

| Component | Purpose | Responsive Notes |
|-----------|---------|-----------------|
| ... | ... | ... |

### Accessibility

How does this feature meet WCAG 2.1 AA? Any specific ARIA requirements?

## 8. Test Plan

### E2E Tests (Playwright)

| Test File | Scenario |
|-----------|----------|
| tests/e2e/... | ... |

### Unit Tests (Vitest)

| Test File | What It Covers |
|-----------|---------------|
| src/domain/.../....test.ts | ... |

### Integration Tests (Vitest + Testcontainers)

| Test File | What It Covers |
|-----------|---------------|
| src/application/.../....int-test.ts | ... |

## 9. Implementation Order

Numbered sequence of implementation steps. Each step should be a
committable unit of work. Follow the Constitution's TDD workflow:
tests first, then minimum implementation.

1. [ ] Step description → commit: `type(scope): message`
2. [ ] ...

## 10. ADR Required?

Review the ADR trigger criteria from AGENTS.md:
- [ ] New library or external tool?
- [ ] CI pipeline change?
- [ ] New project-wide standard?
- [ ] Non-obvious architectural trade-off?

If any are checked: create the ADR before implementation begins.

**ADR:** [link or "none required"]

## 11. Risks & Open Questions

- List anything uncertain, risky, or requiring human judgment.

---

## Implementation Deviations

> **Instruction to implementing agent:** During implementation, capture
> deviations and observations as they happen in
> `docs/implementation-notes/SPEC-NNN-<slug>.md` (rolling log). At close-out,
> triage that log and populate this table with anything that changed the
> design intent vs. this approved spec. Use the spec's Post-Implementation
> Notes for learnings, and `docs/tech-debt.md` for unresolved debt that must
> outlive the spec.
>
> Be honest — this section is for learning, not blame.

| # | Deviation | Reason | Impact | Resolved? |
|---|-----------|--------|--------|-----------|
| 1 | ... | ... | ... | Yes / No → TD-NNN |

### Post-Implementation Notes

_Free-form notes from the implementing agent about what they learned,
what was surprising, or what they'd do differently next time._
