# Implementation Notes — SPEC-015: Visa Requirements — Data & Domain Modelling

**Spec:** [SPEC-015-visa-requirements-modelling](../specs/SPEC-015-visa-requirements-modelling.md)
**Started:** 2026-06-15

> Rolling log written by the implementing agent. Append new entries at the
> bottom as they happen — do not rewrite history. Each entry is a single
> observation, decision, or surprise. At spec close-out, every entry is
> triaged into one of: spec deviations table, spec post-implementation notes,
> docs/tech-debt.md, or discarded.

## Entries

### 2026-06-15 21:45 — Implementation started

**Step:** Pre-flight
**Type:** decision
**Note:**

Implementing on `claude/impl-015-visa-requirements-modelling` off `main`
(SPEC-015 merged via #158). Following the SPEC §12 order but building the pure
domain core (types + evaluator) first with TDD since it's self-contained and the
highest-value heart of the spec, then schema/migration, repository, seed, the AI
extraction job, and the traveller-profile wiring.

**Triage (filled at close-out):**

---

## Close-out triage summary

| Entry | Landed in |
|-------|-----------|
| 1 | _pending_ |
