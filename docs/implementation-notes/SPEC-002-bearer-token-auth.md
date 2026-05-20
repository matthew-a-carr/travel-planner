# Implementation Notes — SPEC-002: Bearer-Token Auth Alongside Cookie Sessions

**Spec:** [SPEC-002](../specs/SPEC-002-bearer-token-auth.md)
**Started:** 2026-05-20

> Rolling log written by the implementing agent. Append new entries at the
> bottom as they happen — do not rewrite history. Each entry is a single
> observation, decision, or surprise. At spec close-out, every entry is
> triaged into one of: spec deviations table, spec post-implementation
> notes, docs/tech-debt.md, or discarded.

## Entries

### 2026-05-20 — step 1 — jose pinned as `dependencies`, not `devDependencies`

**Step:** Step 1 (jose pin + env var)
**Type:** deviation (small)
**Note:**

SPEC §6 and §12 said pin jose as a direct **dev**Dep. That was wrong —
`bearer-token.ts` (slice 2 step 3) imports `jose` at runtime, so it must
ship in the production bundle. Pinning under `dependencies` instead of
`devDependencies`.

**Triage:** _see triage summary below_

## Close-out triage summary

| Entry | Landed in |
|-------|-----------|
