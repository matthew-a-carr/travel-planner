# Implementation Notes — SPEC-017: Visas Panel

**Spec:** [SPEC-017-visas-panel](../specs/SPEC-017-visas-panel.md)
**Started:** 2026-06-16

## Entries

### 2026-06-16 22:45 — Hardcoded assumption removed backward-compatibly

**Step:** §12 step 5
**Type:** decision
**Note:** Made `nationalities` optional on `AnalyseTimelineInput` and a
defaulted (`[]`) trailing param on `analyseTripTimeline`, with the adapter
falling back to "the United Kingdom" when empty. This retires the hardcoded
"UK passport holder" string (SPEC-015 step 11) without disturbing the existing
timeline insights tests/callers. The cache key now includes the sorted
nationality list so different passports cache separately.

**Triage:** post-impl-note

### 2026-06-16 22:50 — e2e seeds visa reference data in global setup

**Step:** §12 step 6
**Type:** decision
**Note:** Added zone/membership/rule seeding to `tests/e2e/setup/global.setup.ts`
(it previously seeded only country references). This makes visa data available to
all e2e specs and matches what `pnpm db:seed` does in prod. The panel e2e then
seeds a GBR passport + a Schengen-overstay trip directly via DB and asserts the
warning renders.

**Triage:** post-impl-note

### 2026-06-16 22:52 — Integration + e2e are CI-gated locally

**Step:** §9 verification
**Type:** blocker (environment)
**Note:** Same Docker Hub rate limit — the e2e spec and the (unchanged)
`analyse-trip-timeline` int-test run on CI. Locally verified: unit (484, incl. 7
new view-helper tests), lint, type-check, and `pnpm build` (both trip pages
compile).

**Triage:** post-impl-note

## Close-out triage summary

| Entry | Landed in |
|-------|-----------|
| 1 | Post-impl note |
| 2 | Post-impl note |
| 3 | Post-impl note + PR body |
