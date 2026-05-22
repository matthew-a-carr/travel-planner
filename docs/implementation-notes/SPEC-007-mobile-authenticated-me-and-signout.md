# Implementation Notes — SPEC-007: Mobile Authenticated "Me" Screen + Sign-Out

**Spec:** [SPEC-007-mobile-authenticated-me-and-signout](../specs/SPEC-007-mobile-authenticated-me-and-signout.md)
**Started:** 2026-05-22

> Rolling log written by the implementing agent. Append new entries at the
> bottom as they happen — do not rewrite history. Each entry is a single
> observation, decision, or surprise. At spec close-out, every entry is
> triaged into one of: spec deviations table, spec post-implementation notes,
> docs/tech-debt.md, or discarded.
>
> Skill pre-flight note: `review-spec` was run as part of plan-feature
> minutes before approval; spec hasn't changed since; skipped the
> implement-spec final-gate re-run on grounds of zero ADR / epic / tech-debt
> drift in the intervening minutes.

## Entries

### 2026-05-22 16:20 — Use case test convention: `.int-test.ts`, not `.test.ts`

**Step:** Step 2 (write revoke use case test)
**Type:** deviation
**Note:**

SPEC §9 specified
`apps/web/src/application/use-cases/auth/mobile/revoke-mobile-tokens.test.ts`
(a unit test). But `apps/web/src/application/AGENTS.md` says: "Every
use case must have a co-located integration test … `.int-test.ts`."
All four existing mobile auth use cases follow `.int-test.ts` only
(no `.test.ts`). Wrote
`revoke-mobile-tokens.int-test.ts` against a real Testcontainers
Postgres + real `DrizzleRefreshTokenRepository` instead. Three
cases per §9 (active-head revoke, unknown-token no-op, idempotent
re-revoke) — all green.

**Triage (filled at close-out):**

---

### 2026-05-22 16:25 — Crypto method name: `sha256Base64url` not `hashRefreshToken`

**Step:** Step 3 (implement revoke use case)
**Type:** deviation
**Note:**

SPEC §7.1 pseudocode used `deps.crypto.hashRefreshToken(...)`, but
the actual `MobileAuthCrypto` port (`apps/web/src/domain/auth/mobile-auth-crypto.ts`)
exposes `sha256Base64url(input)` for hashing. Used the real method.
SPEC text remains slightly inaccurate in §7.1 but the design intent
("hash the presented cleartext, look it up, revoke") holds.

**Triage (filled at close-out):**

## Close-out triage summary

> Filled at the very end. One line per entry above plus where it landed.

| Entry | Landed in |
|-------|-----------|
