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
**Type:** deviation (resolved pre-implementation)
**Note:**

The spec sketched `apps/web/scripts/seed-e2e-fixtures.ts` (hedged with
"location may follow repo convention"). The vitest integration project only
includes `src/**/*.int-test.ts`, so a test next to a `scripts/` module would
never run — and the seed needs the drizzle schema anyway, which lives in
`src/infrastructure/db/`. Landed as `src/infrastructure/db/seed/e2e-fixtures.ts`
(+ `seed-e2e.ts` CLI entry + int-test alongside), matching the existing
`seed.ts` / `country-list-seed.ts` pattern. Package script `seed:e2e` as
specced.

**Triage (filled at close-out):** discarded — review-spec caught it before any code; the spec was amended in the same PR, so the implementation matches the final spec

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
(The fixed dates do bracket the fixed anchor 2026-06-12 — Kyoto contains
it — so the spec's wording holds as written.)

**Triage (filled at close-out):** post-impl-note

---

### 2026-06-12 10:55 — first dispatch run green; runtime baseline recorded

**Step:** Step 4: CI wiring verification
**Type:** learning
**Note:**

`workflow_dispatch` run 27410045709 (mobile=true) — mobile-e2e **green on
the first attempt**, 13m47s wall clock. New-step costs: Postgres 16s,
migrate+seed 4s, `.next` cache restore 1s (miss — first run), `pnpm build`
24s, backend start 0s (background), canary+bundle assertion 1s ≈ **~46s
directly attributable**. Baseline: the last `main` mobile-e2e (edce7ca,
run 27408511858) reached Maestro at ~8m49s and was cancelled mid-Maestro
(concurrency group, EPIC-004 docs merge) — comparable total ≈ 12m. Delta
well inside the epic's +5 min pivot bound; the build-cost fear behind
epic Q1's `dev:next` fallback was overblown (arm64 macOS builds Next in
~24s even cold). The canary + `strings` bundle assertion both passed,
operationally resolving epic Q3.

**Triage (filled at close-out):** post-impl-note

---

### 2026-06-12 10:58 — observation: web e2e failed on main's Playwright-cache commit (not this slice)

**Step:** Step 4 (while gathering the baseline)
**Type:** surprise
**Note:**

Main run 27408511858 (edce7ca, "ci(e2e): cache Playwright chromium"): the
web `E2E tests` job FAILED on its own merge commit — the cache-MISS path
installed browsers but the system-deps step (gated "browsers cached")
skipped. Both runs on this branch (cache HIT path) passed. Out of scope
here; surfaced to Matt in the impl PR body.

**Triage (filled at close-out):** discarded — surfaced to Matt in the PR (web e2e concern, not SPEC-013)

---

## Close-out triage summary

> Filled at the very end. One line per entry above plus where it landed.

| Entry | Landed in |
|-------|-----------|
| 1 (fixture location) | Discarded — spec amended pre-implementation via same-PR review loop |
| 2 (fixed absolute dates) | Post-impl note |
| 3 (runtime baseline) | Post-impl note + spec AC7 evidence |
| 4 (main web-e2e failure) | Discarded from spec — surfaced in impl PR body |
