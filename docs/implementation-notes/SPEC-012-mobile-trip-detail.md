# Implementation Notes — SPEC-012: Mobile Trip Detail Screen

**Spec:** [SPEC-012-mobile-trip-detail](../specs/SPEC-012-mobile-trip-detail.md)
**Started:** 2026-06-11

> Rolling log written by the implementing agent. Append new entries at the
> bottom as they happen — do not rewrite history.

## Entries

### 2026-06-11 — tsc caught six StyleSheet keys Jest couldn't

**Step:** Step 2: detail screen
**Type:** learning
**Note:**

The screen referenced `styles.notFoundTitle` / `errorText` / `retryButton`
(+3) before they existed in the StyleSheet; all 119 Jest tests passed
(Babel strips types) and only `pnpm type-check` failed. Component tests
alone are not a type gate on mobile.

**Triage (filled at close-out):** post-impl-note

---

## Close-out triage summary

| Entry | Landed in |
|-------|-----------|
| 1 (tsc vs Jest type gap) | Post-impl note |
