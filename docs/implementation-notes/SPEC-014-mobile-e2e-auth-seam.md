# Implementation Notes — SPEC-014: Mobile E2E — Test-Auth Seam + Signed-In Journey

**Spec:** [SPEC-014-mobile-e2e-auth-seam](../specs/SPEC-014-mobile-e2e-auth-seam.md)
**Started:** 2026-06-13

> Rolling log written by the implementing agent. Append new entries at the
> bottom as they happen — do not rewrite history. Each entry is a single
> observation, decision, or surprise. At spec close-out, every entry is
> triaged into one of: spec deviations table, spec post-implementation notes,
> docs/tech-debt.md, or discarded.

## Entries

### 2026-06-13 — use case mirrors `handle-mobile-callback` minus Google

**Step:** Step 2 — `mint-test-exchange-code` use case
**Type:** decision
**Note:**

Rather than invent a new flow, `makeMintTestExchangeCode` is structurally
`handle-mobile-callback` with the Google `exchangeAuthCode` step removed:
same state validation (single-use + TTL), same access check
(`findByEmail` → `isApproved`), same one-time-code minting keyed to the
state's stored `code_challenge`, same `travelplanner://auth?...` deep-link
contract. That's what lets the substitute browser leg return the *identical*
URL shape `/callback` 302-redirects to, so `runSignInFlow` can't tell the
seam from the real flow — and the real `/exchange` verifies the client's
verifier against the minted challenge with zero special-casing.

**Triage (filled at close-out):** spec post-impl note — the parallel is the
design's load-bearing property.

### 2026-06-13 — gate is evaluated per request, not at module load

**Step:** Step 3 — `/test-token` route double gate
**Type:** decision
**Note:**

`seamEnabled()` reads `process.env.E2E_TEST_AUTH` / `process.env.VERCEL`
inside the handler so the route int-test can toggle both between cases in one
vitest process (404-when-unset, 404-on-Vercel-even-when-set, 200-when-both).
A test-only endpoint reading two env vars per call is free. The kill-criterion
proof (AC3) is the first of those cases.

**Triage:** discarded — captured in the SPEC §14 already.

### 2026-06-13 — `EXPO_PUBLIC_*` inlining vs unit-testability

**Step:** Step 4 — `resolveBrowserLeg`
**Type:** surprise/decision
**Note:**

Expo inlines `process.env.EXPO_PUBLIC_*` at bundle time, which makes a
module-top read awkward to unit-test (the value is frozen by babel). Gave
`resolveBrowserLeg(flag = process.env.EXPO_PUBLIC_E2E_AUTH)` an injectable
parameter: the screen calls `resolveBrowserLeg()` (reads the inlined env), the
unit test passes the flag explicitly. The substitute itself (`e2eOpenAuthSession`)
is tested directly with a fetch spy, so the meaty logic isn't behind the env
guard at all.

**Triage:** spec post-impl note.

### 2026-06-13 — full local verification green

**Step:** Verification
**Type:** observation
**Note:**

`pnpm lint` ✓, `pnpm type-check` (web + mobile) ✓, `pnpm test:unit`
(web 439 + mobile 124) ✓, `pnpm test:integration` (61 files / 330 tests,
incl. the new `mint-test-exchange-code.int-test.ts` and the extended
`route.int-test.ts`) ✓, `pnpm build` ✓ (the `/api/v1/auth/mobile/test-token`
route shows in the route manifest), `pnpm openapi:check` ✓ (the seam is
deliberately unpublished, so no spec drift). The `mobile-e2e` macOS job is the
remaining gate — it runs the `signed-in-journey` flow against the real backend
on the impl PR.

**Triage:** spec post-impl note (runtime delta for slice 4's budget checkpoint
recorded once the PR's `mobile-e2e` run lands).
