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

### 2026-06-15 22:00 — Scoped this PR to the foundation; deferred steps 9–11

**Step:** §12 steps 9–11
**Type:** decision
**Note:**

This PR delivers SPEC-015 §12 steps 1–8 + 12: the schema/migration, the full
pure evaluator (22 unit tests), the repository (+ int-test), an initial
hand-authored GBR seed (Schengen + Australia tourist/working-holiday + JPN/USA/
THA/VNM, `source: 'manual'`, reviewable in the diff), the `assess-trip-visas`
use case (+ int-test), and ADR 061 + doc sync. Deferred to a clearly-flagged
follow-up:
- **Step 9** — the `VisaRuleExtractor` AI port + `fetch-visa-rules` script. A
  large, separable sub-deliverable.
- **Step 10** — the broad ~200-country AI-extracted seed. Requires the
  mandatory human-review gate (SPEC §8) regardless, so it is genuinely a
  separate review unit; the hand-authored seed proves the pipeline now.
- **Step 11** — replacing the hardcoded "UK passport holder" assumption in
  `anthropic-timeline-insights.ts`. Intertwined with traveller-profile capture
  (EPIC-005 slice 2/3); deferred to avoid a half-wired prompt change.

SPEC kept **In Progress** rather than Complete for this reason.

**Triage (filled at close-out):** post-impl-note

---

### 2026-06-15 22:00 — Integration tests not runnable in this sandbox (Docker Hub rate limit)

**Step:** §9 verification
**Type:** blocker (environment, non-blocking for CI)
**Note:**

`pnpm test:integration` could not run locally: Testcontainers failed to pull
`postgres` — `(HTTP code 500) ... unauthenticated pull rate limit` — and no
image is cached. Unit suite (461 web, incl. 22 visa), lint, type-check, and
`db:check:migrations` all pass locally. The two new `.int-test.ts` files are
the CI `integration-test` job's gate (GitHub runners have Docker). Flagged in
the PR body as a CI-gated item.

**Triage (filled at close-out):** post-impl-note

---

### 2026-06-15 22:00 — Minor evaluator simplifications vs SPEC

**Step:** §7 design
**Type:** deviation
**Note:**

(1) `evaluateCoverage` returns a `CoverageEvaluation` (status + violations +
applied-rule fields); `assessVisas` assembles the full `CountryCoverage`
(adding `appliedNationality`, `stay`, `alternativeRuleIds`) — the SPEC sketched
`evaluateCoverage` as returning `CountryCoverage` directly, but it can't know
the passport. (2) `pickBestCoverage` ranks by status → category → fewer
violations → nationality, dropping the SPEC's `maxStayDays`/`entryType`
tie-breakers (not carried on `CountryCoverage`); still satisfies "most
favourable". (3) `CountryStay` gained a `countries: Alpha3[]` field so zone
groups can look up member-country rules.

**Triage (filled at close-out):** spec-deviation #1

---

## Close-out triage summary

| Entry | Landed in |
|-------|-----------|
| 1 (start) | Discarded (process note) |
| 2 (scope/deferral) | Post-impl note + PR body |
| 3 (integration env) | Post-impl note + PR body |
| 4 (evaluator deviations) | Spec deviation #1 |
