# ADR 049: Epic Tier for Multi-SPEC Initiatives

**Date:** 2026-05-20
**Status:** Accepted
**Extends:** [ADR 047 — Specification-Driven AI Development Lifecycle](./047-specification-driven-ai-development-lifecycle.md), [ADR 048 — Grilling Step and Rolling Implementation Notes](./048-grilling-and-implementation-notes.md)

## Context

ADR 047 introduced SPECs as the unit of planned work. ADR 048 added a
pre-spec grilling step and per-spec rolling implementation notes. Both
artefacts are sized for **one shippable feature** — a single PR's worth of
design.

The iOS work that ADR 045 sketches is far larger than that. The strategic
decision (Option C: Expo + RN against extracted Route Handlers + shared
TS types) implies ~9 sequenced slices, several cross-cutting decisions
that every slice inherits (REST conventions, auth model, observability
vendor), external dependencies that shape the whole effort (Apple
Developer Program, Expo Go), and pre-committed kill criteria.

Forcing this into a single SPEC drowns the SPEC. Splintering it across nine
independent SPECs loses sequencing, cross-cutting consistency, and any
"are we done yet?" gate. The previous solution — a freeform
`docs/ios-app-planning.md` — was a half-step: it captured the substance
but had no lifecycle, no grilling, no kill criteria, no slice ledger, and
went stale silently.

## Decision

Introduce an **epic tier** above SPECs.

An epic is a multi-SPEC initiative: too big for one specification but
sharing one vision, one set of cross-cutting decisions, and one
sequencing/kill plan. Epics sit between strategic ADRs (which decide
*direction*) and SPECs (which describe *one shippable unit*).

### Artefacts

- **`docs/epics/EPIC-NNN-title.md`** — one file per epic, written from
  `docs/epics/_template.md`. Sections include vision, definition of done,
  demo script, vertical slices with dependencies and status, sequencing
  rationale, kill / pivot criteria, cross-cutting decisions, external
  dependencies, cost & budget, open questions, parking lot, risks, ADR
  triggers, slice ledger, and epic-level deviations.
- **`docs/epics/README.md`** — index of all epics with status.

### New skill

- **`.agents/skills/plan-epic/SKILL.md`** — mirrors `plan-feature` but at
  epic altitude. Invokes `grill-me` to interrogate vision, slicing, kill
  criteria, and cross-cutting decisions; then writes EPIC-NNN. Does **not**
  write SPECs — those are created via `plan-feature` slice-by-slice when
  each slice is ready.

### Wiring

- `plan-feature` becomes epic-aware: if a SPEC declares a `Parent epic`,
  the skill reads the epic's cross-cutting decisions (§10) and treats them
  as out-of-scope for re-grilling, updates the epic's slice ledger and
  slice table on every status change, and links back from SPEC → epic.
- `implement-spec` is unchanged operationally, but its triage step now has
  one extra landing place: if a deviation forces a change to a
  cross-cutting decision or to slice sequencing, it lands in the epic's
  §16 "Epic-level deviations" rather than (or in addition to) the SPEC's
  deviations table.

### Lifecycle

```
Draft → Approved → In Progress → Complete
                               → Abandoned (kill criterion hit, or pivoted)
```

The same human-approval gate as SPECs (ADR 047) applies before
implementation of any slice begins.

### Existing SPEC template revision

The SPEC template is revised in the same commit as this ADR. New
top-of-file `Parent epic` field. New sections: `Out of scope`, `Demo
script`, `Prerequisites`, `Security & data considerations`,
`Observability`, `Rollback / safety`. The architecture-layer
decomposition is loosened so mobile- and package-shaped specs can use
sections that match their structures rather than forcing the web layer
shape. The `ADR Required?` section becomes `ADR triggers and tech-debt
review` to make the tech-debt cross-check explicit.

## Consequences

**What becomes easier:**

- Large initiatives have a place to live that isn't a drowned SPEC or an
  ungoverned freeform doc.
- Cross-cutting decisions are settled once at epic level. Child SPECs
  inherit them; reviewers don't relitigate the same trade-offs ten times.
- Kill criteria are pre-committed. When the epic struggles, the question
  "do we stop?" has an honest answer rather than sunk-cost momentum.
- The slice ledger and epic-level deviations table create a durable record
  of what shifted vs the original plan — useful both for retrospectives
  and for future epics in the same area.
- The lifecycle remains spec-first: each slice still goes through
  `grill-me` → `plan-feature` → human approval → `implement-spec`. The
  epic constrains scope; it does not replace any of those steps.

**What becomes harder:**

- A new artefact tier and a new skill. Discoverability matters; the
  AGENTS.md index and lifecycle section are updated in the same commit.
- One more lifecycle gate before slice work can start. Justified for true
  epics; over-engineered for anything smaller. The epic-trigger criteria
  (in `docs/epics/README.md`) keep this from being applied to every
  feature.
- ADR numbering can no longer be pre-allocated for upcoming epic slices.
  Numbers are claimed at write time. Existing pre-allocated references
  (notably in ADR 045) are corrected to point at EPIC-001 §16 instead.

**Trade-offs:**

- Epics live in the repo, not in a project-management tool. Same trade-off
  as SPECs (ADR 047): versioned and agent-accessible, but not queryable
  externally. Jira tickets may link to epics for cross-referencing.
- Cross-cutting decisions in §10 of an epic are intentionally rigid:
  child SPECs cannot quietly contradict them. The pressure-release valve
  is the epic-level deviations table — a child SPEC may force a change,
  but it must be visible.
