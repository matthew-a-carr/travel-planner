# Implementation Notes — SPEC-018: Per-Trip Visa Intent Selector

**Spec:** [SPEC-018-trip-intent-selector](../specs/SPEC-018-trip-intent-selector.md)
**Started:** 2026-06-16

## Entries

### 2026-06-16 11:05 — Intent kept off the Trip aggregate

**Step:** §7 design
**Type:** decision
**Note:** ~20 files construct `Trip` literals; adding a required `intent` field to
the aggregate would mean broad, risky churn across unrelated tests. Modelled
intent as a focused per-trip setting on `trips.intent`, accessed via two new
`TripRepository` methods (`getIntent`/`setIntent`). The trip page reads it with
one extra cheap query. Two existing `TripRepository` mock test-doubles
(`process-chat-message.test.ts`, `chat-tools.test.ts`) gained the two methods.

**Triage:** spec-deviation #1

### 2026-06-16 11:12 — Selector auto-submits with a no-JS fallback

**Step:** §7 UI
**Type:** decision
**Note:** `TripIntentSelector` auto-submits the form on `<select>` change via
`requestSubmit()`, with an always-visible "Apply" button as the no-JS fallback.
The server action re-checks org membership before persisting (never trusts the
form for identity).

**Triage:** post-impl-note

### 2026-06-16 11:13 — Integration + e2e are CI-gated locally

**Step:** §9 verification
**Type:** blocker (environment)
**Note:** Docker Hub rate limit again — `set-trip-intent.int-test.ts` and the
`14-trip-intent` e2e run on CI. Locally verified: unit (488, incl. 4 new), lint,
type-check, `db:check:migrations`, and `pnpm build`.

**Triage:** post-impl-note

## Close-out triage summary

| Entry | Landed in |
|-------|-----------|
| 1 | Spec deviation #1 |
| 2 | Post-impl note |
| 3 | Post-impl note + PR body |
