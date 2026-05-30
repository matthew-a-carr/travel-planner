# SPEC-NNN: [Feature Title]

**Date:** YYYY-MM-DD
**Status:** Draft | Approved | In Progress | Complete | Abandoned
**Author:** [human / agent name]
**Approved by:** [human name + date, or "—"]
**Parent epic:** [EPIC-NNN link, or "—" if standalone]

> A spec is one shippable unit. It either stands alone or is a slice of an
> epic. If the work needs more than one spec to deliver demoable value, file a
> `claude:plan-epic` issue first (the `draft-epic` routine drafts the EPIC) and
> link from this field.
>
> **Fill in every section.** Use `N/A — [reason]` for sections that genuinely
> don't apply (e.g. "Migration plan — N/A, no data change"). Don't delete
> sections unless their inapplicability is so obvious that seeing them would
> confuse a reader.

---

## 1. Summary

One paragraph from the user's perspective. What changes for the user when
this ships?

## 2. Motivation

Why does this exist? What problem does it solve? Link to the parent epic,
Jira ticket, user feedback, or product goal that drives it. If this slice
inherits cross-cutting decisions from a parent epic, note them here rather
than re-explaining them — link the epic's §10.

## 3. Acceptance criteria

Numbered, observable behaviours that define done. Each maps to at least one
test in §9. Use Given/When/Then where it sharpens the criterion; not all
criteria need it.

1. Given …, when …, then …
2. ...

## 4. Demo script

What you would literally walk through to show a reviewer the spec is done.
Action-by-action. Forces the criteria above to translate into something
concrete.

1. ...
2. ...

## 5. Out of scope

Equal weight to acceptance. What this spec deliberately does **not** do, so
reviewers (and future-you) don't widen the scope mid-implementation. If
something is out of scope because the parent epic settled it, link the
epic's §6 or §10 instead of re-arguing it.

- ...

## 6. Prerequisites

What must be true before implementation starts. Other SPECs landed, env
vars provisioned, secrets created, third-party accounts set up, feature
flags toggled. If a prerequisite is unmet, the spec is not yet Approved.

- ...

## 7. Design

How the change works. Subsections below are starting points — keep,
combine, or replace them with whatever maps to the affected layers. For a
web change inside `apps/web/`, the standard `domain → application →
infrastructure → ui` decomposition usually fits. For mobile (`apps/mobile/`),
shared packages (`packages/*`), or infra (`infra/`), use sections that
match those structures instead.

### Data & domain

New / changed types, entities, value objects, invariants. Reference the
appropriate `AGENTS.md` for the affected layer.

### Behaviour

New / changed use cases, services, handlers, components. Inputs, outputs,
error envelopes, side effects.

### Storage & migrations

Schema deltas, migration plan, backfill or zero-downtime considerations,
rollback steps. State `N/A` if no storage change.

### External integrations

New or changed third-party APIs, providers, or services. Note rate limits,
auth flow, error handling, retries.

### UI / UX

Routes, pages, components, navigation. Responsive notes. Accessibility
target (WCAG 2.1 AA — see ADR 007). State the keyboard and screen-reader
behaviour, not just the visual.

## 8. Security & data considerations

Auth, authorisation, secrets, PII, data exposure surfaces, input
validation, output escaping. State `N/A — [reason]` only if you're certain
none apply.

- Threats considered: ...
- Mitigations: ...
- Secrets needed: ...

## 9. Test plan

Tests are written **before** implementation per CONSTITUTION.md §3.

### E2E (Playwright / Maestro / etc)

| Test file | Scenario |

### Integration (Vitest + Testcontainers, or platform equivalent)

| Test file | What it covers |

### Unit (Vitest, Jest, etc)

| Test file | What it covers |

### Manual checks

Anything that can't be automated cheaply — usability, screen-reader passes,
real-device install — listed so it's not silently skipped.

## 10. Observability

How will we know this works once deployed? Logs, metrics, traces, Sentry
breadcrumbs. If the spec adds a meaningful new user flow, add at least one
metric or log point so post-deploy verification is possible.

- Logs: ...
- Metrics: ...
- Sentry / error reporting: ...

## 11. Rollback / safety

If this ships and breaks, how do we back out? Feature flag? Migration
reversibility? Revert-and-deploy? State the procedure explicitly for any
spec touching production data, auth, or money.

## 12. Implementation order

A sequence of small steps. Each step pairs *intent* with *verification* —
the test or check that proves it's done — and is small enough to commit on
its own. Follow CONSTITUTION.md §3: tests first, then minimum
implementation.

1. [ ] **Intent:** … **Verification:** … (test file or check)
2. [ ] ...

## 13. ADR triggers and tech-debt review

### ADR?

Review the ADR trigger criteria from `AGENTS.md`. Tick all that apply.

- [ ] New library, external tool, or vendor
- [ ] CI pipeline or workflow structural change
- [ ] New project-wide standard
- [ ] Non-obvious architectural trade-off
- [ ] Cross-cutting decision not already settled by the parent epic

**ADRs to write:** [list, or "none required"]

### Tech debt

- [ ] I reviewed `docs/tech-debt.md` and noted any items this spec touches
  or could resolve.

**Tech debt items addressed by this spec:** [list or "none"]

## 14. Risks & open questions

Anything uncertain, risky, or requiring human judgement. If an open
question would change the design materially, **stop and re-grill** rather
than guessing.

- ...

---

## Implementation Deviations

> **Instruction to implementing agent:** During implementation, capture
> deviations and observations as they happen in
> `docs/implementation-notes/SPEC-NNN-<slug>.md` (rolling log). At
> close-out, triage that log and populate this table with anything that
> changed the design intent vs. this approved spec. Use the spec's
> Post-Implementation Notes for learnings, and `docs/tech-debt.md` for
> unresolved debt that must outlive the spec.
>
> Be honest — this section is for learning, not blame.

| # | Deviation | Reason | Impact | Resolved? |
|---|-----------|--------|--------|-----------|
| 1 | ... | ... | ... | Yes / No → TD-NNN |

### Post-Implementation Notes

_Free-form notes from the implementing agent about what they learned, what
was surprising, or what they'd do differently next time. Concrete enough
that a future spec in this area can re-use the insight._
