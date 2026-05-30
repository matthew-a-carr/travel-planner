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
- Single-SPEC features (open a Feature request issue with label
  `claude:plan` instead).
- Tactical refactors with no user-facing demo.
- Anything where the strategic ADR is already the right level of detail
  and slicing is obvious.

## Lifecycle

```
Issue opened (claude:plan-epic)
  → draft-spec routine writes EPIC-NNN → opens epic PR
    → human reviews / labels claude:revise-now → revise loop
      → epic PR merged → human files claude:plan issues for each slice
        → each slice flows through the standard SPEC lifecycle
```

1. Strategic ADR exists (or is drafted alongside).
2. Open an issue with the **Epic** template (label `claude:plan-epic`). The
   `draft-spec` skill (epic mode) writes EPIC-NNN on a `claude/epic-NNN-*`
   branch and opens a PR. Per ADR 057.
3. Human reviews. Feedback loop runs via PR comments + `claude:revise-now`
   label.
4. Merge the epic PR. The routine does NOT auto-file slice issues — Matt
   files one `claude:plan` issue per slice (or asks a follow-up routine
   run to file them).
5. Each slice flows through the standard SPEC lifecycle (see
   `docs/specs/README.md`).
6. Epic-level deviations (changes to cross-cutting decisions or slice
   order) are logged in the epic; per-slice deviations stay in the SPEC.
7. Epic marked Complete when all in-scope slices are shipped or
   explicitly dropped, or Abandoned if a kill criterion fires.

See [ADR 049](../decisions/049-epic-tier-for-multi-spec-initiatives.md)
for rationale.

## Index

| Epic | Title | Strategic ADR | Status |
|------|-------|---------------|--------|
| [001](EPIC-001-ios-app.md) | iOS App — Expo + React Native against extracted REST API | [045](../decisions/045-ios-app-strategy.md) | Approved |
