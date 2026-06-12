# Implementation Notes — SPEC-013: Mobile E2E — Real Backend in the CI Loop

**Spec:** [SPEC-013-mobile-e2e-real-backend](../specs/SPEC-013-mobile-e2e-real-backend.md)
**Started:** 2026-06-12

> Rolling log written by the implementing agent. Append new entries at the
> bottom as they happen — do not rewrite history. Each entry is a single
> observation, decision, or surprise. At spec close-out, every entry is
> triaged into one of: spec deviations table, spec post-implementation notes,
> docs/tech-debt.md, or discarded.

## Entries

### 2026-06-12 10:30 — fixture seed moved from `scripts/` to `src/infrastructure/db/seed/`

**Step:** Step 1–2: fixture seed + integration test
**Type:** deviation
**Note:**

The spec sketched `apps/web/scripts/seed-e2e-fixtures.ts` (hedged with
"location may follow repo convention"). The vitest integration project only
includes `src/**/*.int-test.ts`, so a test next to a `scripts/` module would
never run — and the seed needs the drizzle schema anyway, which lives in
`src/infrastructure/db/`. Landed as `src/infrastructure/db/seed/e2e-fixtures.ts`
(+ `seed-e2e.ts` CLI entry + int-test alongside), matching the existing
`seed.ts` / `country-list-seed.ts` pattern. Package script `seed:e2e` as
specced.

**Triage (filled at close-out):**

---

### 2026-06-12 10:35 — destination dates are fixed absolutes, not relative to run time

**Step:** Step 1: fixture design
**Type:** decision
**Note:**

The spec says "dates bracketing a fixed 'today' anchor". Truly bracketing the
*run-time* today would make the fixtures non-deterministic (computed from
`Date.now()`), which contradicts acceptance criterion 4's "stable IDs/values".
Chose fixed absolute dates (Kyoto 2026-06-01→15, Tokyo 2026-06-15→30).
Slices 2–3 assert names/figures, not relative dates. If EPIC-003's
destination-from-today inference flow ever needs "today inside a range", that
fixture extends then (relative dates for one destination only).

**Triage (filled at close-out):**

---

## Close-out triage summary

> Filled at the very end. One line per entry above plus where it landed.

| Entry | Landed in |
|-------|-----------|
