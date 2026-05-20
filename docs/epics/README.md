# Epics

An **epic** is a multi-SPEC initiative — too big for one specification but
sharing one vision, one set of cross-cutting decisions, and one
sequencing/kill plan.

Epics sit between strategic ADRs (which decide *direction*) and SPECs
(which describe *one shippable unit*). They answer: given the strategic
decision, what's the slice plan, in what order, and what would make us
stop?

## When to write an epic

Write an epic when:
- The work needs more than ~3 SPECs to deliver real user value.
- Sequencing across SPECs matters — slice N unblocks slice N+1.
- Cross-cutting decisions (auth, packaging, observability) should be
  settled once rather than re-litigated per SPEC.
- There's a meaningful chance the work is killed or pivoted partway, and
  pre-committing exit criteria matters.

Do **not** write an epic for:
- Single-SPEC features (use `plan-feature` directly).
- Tactical refactors with no user-facing demo.
- Anything where the strategic ADR is already the right level of detail
  and slicing is obvious.

## Lifecycle

```
Draft → Approved → In Progress → Complete
                                → Abandoned (kill criterion hit, or pivoted)
```

1. Strategic ADR exists (or is drafted alongside).
2. `plan-epic` skill grills at epic altitude → writes EPIC-NNN.
3. Human approves the epic.
4. For each slice, when ready: `plan-feature` for that slice's SPEC,
   inheriting the epic's cross-cutting decisions. The child SPEC links
   back to the epic; the epic's slice table tracks SPEC status.
5. `implement-spec` for each SPEC as normal.
6. Epic-level deviations (changes to cross-cutting decisions or slice
   order) are logged in the epic; per-slice deviations stay in the SPEC.
7. Epic marked Complete when all in-scope slices are shipped or
   explicitly dropped, or Abandoned if a kill criterion fires.

See [ADR 049](../decisions/049-epic-tier-for-multi-spec-initiatives.md)
for rationale.

## Index

| Epic | Title | Strategic ADR | Status |
|------|-------|---------------|--------|
| [001](EPIC-001-ios-app.md) | iOS App — Expo + React Native against extracted REST API | [045](../decisions/045-ios-app-strategy.md) | Draft |
