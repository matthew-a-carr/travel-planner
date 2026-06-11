# Implementation Notes — SPEC-011: Mobile Trips List Screen

**Spec:** [SPEC-011-mobile-trips-list](../specs/SPEC-011-mobile-trips-list.md)
**Started:** 2026-06-11

> Rolling log written by the implementing agent. Append new entries at the
> bottom as they happen — do not rewrite history.

## Entries

### 2026-06-11 — Landing-route swap: trips list takes `/`, Me moves to `/me`

**Step:** Pre-flight
**Type:** decision
**Note:**

EPIC-002 §4 line 1 says sign-in lands on the trips list, so the list takes
over `app/(app)/index.tsx` and the EPIC-001 Me screen moves to
`app/(app)/me.tsx` behind a profile button. Verified the Maestro
`sign-in.yaml` flow only asserts the signed-out screen (CI runs no
backend), so the move can't break the `mobile-e2e` gate.

**Triage (filled at close-out):**

---

## Close-out triage summary

| Entry | Landed in |
|-------|-----------|
