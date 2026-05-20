# Implementation Notes — SPEC-003: Mobile App Foundation

**Spec:** [SPEC-003](../specs/SPEC-003-mobile-app-foundation.md)
**Started:** 2026-05-20

> Rolling log written by the implementing agent. Append new entries at the
> bottom as they happen. Triaged at close-out.

## Entries

### 2026-05-20 — step 3 — Jest 30 incompatible with jest-expo SDK 55

**Step:** Step 3 (Jest harness)
**Type:** deviation
**Note:**

SPEC-003 §7 listed `"jest": "^30.0.0"` and `"@types/jest": "^30.0.0"`.
First test run failed with
`TypeError: this._moduleMocker.clearMocksOnScope is not a function` —
jest-expo SDK 55 ships with Jest 29 internals and is incompatible
with Jest 30's runtime.

Pinned to `jest@^29.7.0` and `@types/jest@^29.5.14`. Will need to
revisit when jest-expo ships Jest 30 support (likely Expo SDK 56 or
its canary line — `jest-expo@next` is tagged 56.0.3).

**Triage:** see triage summary below

---

### 2026-05-20 — step 3 — custom `transformIgnorePatterns` broke pnpm-aware defaults

**Step:** Step 3 (Jest harness)
**Type:** decision
**Note:**

SPEC-003 §7 spec'd a custom `transformIgnorePatterns` listing
react-native, expo, etc. That pattern doesn't match pnpm's
`.pnpm/<pkg>@<ver>/node_modules/<pkg>/...` path layout, so Jest tried
to load `react-native/jest/setup.js` un-transformed and choked on
`import` syntax.

Removed the custom override. jest-expo's preset has its own
pnpm-aware defaults and Just Works™. Lesson: trust the preset; only
override when there's evidence the default isn't matching what you
need.

**Triage:** see triage summary below

_(append further entries here as work proceeds)_

## Close-out triage summary

| Entry | Landed in |
|-------|-----------|
