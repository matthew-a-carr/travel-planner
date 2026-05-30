# EPIC-NNN: [Title]

**Date:** YYYY-MM-DD
**Status:** Draft | Approved | In Progress | Complete | Abandoned
**Strategic ADR:** [link to the ADR this operationalises, or "—"]
**Owner:** [human name]
**Approved by:** [human name + date, or "—"]

> An epic is a multi-SPEC initiative. Use this template when the work needs
> sequencing across several specs, settles cross-cutting decisions that all
> slices inherit, and benefits from pre-committed kill criteria. Otherwise
> use a SPEC directly.
>
> **Fill in every section.** Use `N/A — [reason]` for sections that genuinely
> don't apply (e.g. "External dependencies — N/A, no third parties"). Delete
> sections only if their inapplicability is so obvious it would confuse a
> reader to see them.

---

## 1. Vision

One paragraph. **What does success look like, told as a single end-user demo?**
No implementation language. Someone reading only this section should
understand what changes for users and roughly why.

## 2. Why now

What changed, what hurts today, what we'll regret not doing if we wait six
more months. Link the strategic ADR for the full context; do not duplicate
its analysis.

## 3. Definition of done

A short, concrete checklist. When every item is ticked, the epic is
Complete. This is **not** the slice plan — it's the gate the slice plan has
to pass through.

- [ ] ...
- [ ] ...

## 4. Demo script

What you would literally walk through to show a reviewer the epic is done.
Action-by-action. The first slice should produce the first line of this
script; the last slice should produce the last.

1. Open …
2. Tap …
3. See …

## 5. Outcome / success criteria

Numbered, observable outcomes at the **epic** level (not per-slice). Bias
toward user-visible behaviour over internal metrics; include metrics only
where they're load-bearing.

1. ...

## 6. Non-goals

Equal weight to goals. What this epic explicitly will **not** do, and why.
Listing a non-goal here means later slices may not pull it back in without
amending the epic.

- ...

## 7. Vertical slices

Each slice is a shippable, demoable unit. The first slice should be the
thinnest possible end-to-end vertical that proves the strategic decision.
Each later slice should add user-visible value, not just infrastructure.

| # | Slice | Demo script line(s) | Becomes SPEC | Depends on | Status |
|---|-------|---------------------|--------------|------------|--------|
| 1 | ... | "A user can …" | SPEC-NNN (Draft) | — | Not started |
| 2 | ... | ... | _not yet planned_ | Slice 1 | Not started |

> SPECs are drafted by the `draft-spec` routine (from a `claude:plan` issue)
> only when the slice is ready to be implemented. Earlier slices may be planned
> in detail; later slices are intentionally vague until preceding learnings
> come in.

## 8. Sequencing rationale

Why this order? What does slice N unlock for N+1? Where are the cliffs? Any
slice that can be parallelised — say so. Any slice whose order is reversible —
say that too, so a future re-sequence doesn't break the epic.

## 9. Kill / pivot criteria

Specific, measurable signals that would cause us to stop or change course.
Decided up front so a future reader (and future you) can evaluate honestly
without re-litigating the original optimism.

- If [X] is observed by [milestone], kill / pivot to [Y].
- ...

## 10. Cross-cutting decisions

Settled once at the epic level so each child SPEC inherits them. Anything
listed here is **out of scope for re-litigation** inside a child SPEC's
grilling — flag a deviation (§16) if a slice forces a change.

| Concern | Decision | Why |
|---------|----------|-----|
| Auth | ... | ... |
| Observability | ... | ... |
| Packaging / shared types | ... | ... |
| Data ownership | ... | ... |
| Versioning / breaking changes | ... | ... |
| Security & data classification | ... | ... |

## 11. External dependencies & constraints

Things outside this codebase that shape the epic: vendor accounts, third-
party APIs, hardware, billing, certificates, regulatory or platform rules.
Note rate limits, sandbox vs production, cost tiers, and any account or
provisioning step that has to happen before a slice can ship.

| Dependency | What we rely on | Constraint / status |
|------------|-----------------|---------------------|

## 12. Cost & budget

Subscriptions, paid services, one-off costs, and (for team work) headcount
or calendar budget. Often what kills epics; record it where it can be seen.

| Item | Cost | When incurred | Decision |
|------|------|---------------|----------|

## 13. Open questions

Questions deliberately deferred rather than guessed. Each has an owner and
the slice by which it must be answered. Defer aggressively — every answer
here that becomes implicit by slice N is a hidden source of rework.

| # | Question | Owner | Answer by slice |

## 14. Parking lot

Explicitly deferred ideas that don't fit the current epic but shouldn't be
lost. Distinct from §6 non-goals: parking-lot items might become future
epics; non-goals will not.

- ...

## 15. Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|

## 16. ADR triggers

Likely ADRs surfaced by slices, written when each slice begins. Do not
pre-allocate ADR numbers — they're claimed at write time.

| Slice | Likely ADR(s) | Notes |
|-------|---------------|-------|

## 17. References

Strategic ADR, prior planning docs, vendor documentation, external prior
art, related epics.

- ...

---

## Slice ledger (append-only)

Updated as slices progress. One row per status change. The append-only
property lets you reconstruct the timeline later.

| Date | Slice # | SPEC | Status change | Notes |
|------|---------|------|---------------|-------|

## Epic-level deviations

Only for changes to cross-cutting decisions (§10), slice sequence (§7), or
definition of done (§3). Per-slice deviations stay in their SPEC's
deviations table.

| # | Deviation | Reason | Impact on other slices | Resolved? |
|---|-----------|--------|------------------------|-----------|

## Post-epic notes

_Filled when the epic closes. What you learned, what was surprising, what
you'd do differently if you ran this epic again. Concrete enough that a
future epic in this codebase can re-use the insight._
