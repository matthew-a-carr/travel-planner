# ADR 048: Grilling Step and Rolling Implementation Notes

**Date:** 2026-05-20
**Status:** Accepted
**Extends:** [ADR 047 — Specification-Driven AI Development Lifecycle](./047-specification-driven-ai-development-lifecycle.md)

## Context

ADR 047 introduced the spec-driven lifecycle (`plan-feature` →
`implement-spec` → `review-tech-debt`) with deviations captured in a table
inside each spec. Two weaknesses emerged before the lifecycle was exercised on
a real feature:

1. **No upstream interrogation.** `plan-feature` went straight from a
   one-paragraph idea to a fully structured spec. The structure forced rigour
   on the *output* but did nothing to challenge the *input*. Hidden
   assumptions, unconsidered alternatives, and missing acceptance criteria
   travelled into the spec unchallenged, surfacing later as deviations or
   throwaway work.

2. **Deviation capture is high-friction.** The spec's "Implementation
   Deviations" table sits at the bottom of a long structured document. To log
   a deviation mid-implementation, the agent has to context-switch, open the
   spec, scroll to the right section, and edit a table. The friction is
   higher than the cost of forgetting, so deviations were always going to be
   under-reported.

The mobile app phase (ADR 045) is about to start, multiplying the
opportunities for both problems: cross-app design questions need real
interrogation, and a new app stack means more deviations from web-shaped
spec templates.

## Decision

Extend ADR 047 with two additions, both implemented as project skills and
docs (no new tooling):

### 1. A grilling step before spec authoring

Use the `grill-me` skill as the mandatory first step of `plan-feature`. It
interviews the user one question at a time, walking down each branch of the
design tree until shared understanding is reached. It does not produce
artefacts itself.

`plan-feature` is responsible for writing the resulting draft brief to
`docs/specs/_draft-NNN-<slug>.md` — refined scope, acceptance signal,
alternatives considered and rejected, open risks, and load-bearing Q→A
pairs. From that point on, the spec consumes the brief as its source of
truth for scope and acceptance.

**Provenance:** `grill-me` is vendored into this repo at
`.agents/skills/grill-me/SKILL.md` from
[`matthew-a-carr/agent-scripts`](https://github.com/matthew-a-carr/agent-scripts).
Vendoring (rather than depending on a separately-installed plugin) keeps the
lifecycle self-contained: any fresh agent in a fresh environment that clones
this repo gets the full skill set with no extra install step. If the
canonical version upstream changes, re-vendor it here.

### 2. Rolling implementation notes (new during-spec artefact)

A per-spec file at `docs/implementation-notes/SPEC-NNN-<slug>.md`, created
when implementation starts and appended to throughout. One timestamped entry
per observation: deviations, surprises, decisions, blockers, learnings.

The principle is **capture cheap, triage deliberate**. Logging an entry is a
single append to a flat file, which makes honest capture cheaper than
forgetting. At spec close-out, `implement-spec` triages every entry into one
of four landing places:

- Spec's Implementation Deviations table (changed design intent)
- Spec's Post-Implementation Notes (learnings)
- `docs/tech-debt.md` (debt outliving the spec)
- Discarded (resolved before close-out)

The notes file is left in place after triage as the raw record. The spec and
tech-debt register remain authoritative.

One exception to the "triage at close-out" rule: cross-cutting hazards
(security, data loss, broken invariant) that another contributor must know
about *today* go straight to `docs/tech-debt.md` with a back-reference.

## Consequences

**What becomes easier:**

- Weak ideas get exposed before a spec is written, not during implementation
  where the cost of changing direction is highest.
- Deviation capture becomes a habit rather than a chore — appending to a flat
  file mid-flight is roughly as cheap as a code comment.
- Triage is now a deliberate synthesis step rather than something hoped for.
  An empty notes file at close-out is itself a signal — either smooth sailing
  or something missed.
- Future readers of a spec can trace not just *what was decided* but *what
  was rejected and why*, via the grilling Q→A pairs in the draft brief
  history.

**What becomes harder:**

- One more artefact per spec. The notes file is intentionally lightweight,
  but it's still a file to remember.
- Grilling adds a step before spec authoring. For genuinely trivial features
  this is friction — but those features don't warrant a spec in the first
  place (ADR 047 already excludes them).
- `_draft-NNN-<slug>.md` files briefly share the numbering pool with specs.
  Convention: the draft brief is deleted (or renamed `.superseded.md`) when
  the spec is committed.

**Trade-offs:**

- Notes are stored in the repo, not an external tool. Same trade-off as
  specs (ADR 047): versioned and agent-accessible, but not queryable from a
  project management tool. Acceptable for the same reasons.
- Triage discipline is required. Untriaged entries should be visible (the
  triage summary table at the bottom makes them so) so reviewers can spot
  drift.
