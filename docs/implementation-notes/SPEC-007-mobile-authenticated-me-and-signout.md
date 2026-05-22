# Implementation Notes — SPEC-007: Mobile Authenticated "Me" Screen + Sign-Out

**Spec:** [SPEC-007-mobile-authenticated-me-and-signout](../specs/SPEC-007-mobile-authenticated-me-and-signout.md)
**Started:** 2026-05-22
**Completed:** 2026-05-22

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

**Triage (filled at close-out):** spec-deviation #1 — added.

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

**Triage (filled at close-out):** spec-deviation #2 — added.

---

### 2026-05-22 16:29 — Route int-test: consolidated file, not a new per-route file

**Step:** Step 4 (write route int-test)
**Type:** deviation
**Note:**

SPEC §9 listed
`apps/web/src/app/api/v1/auth/mobile/revoke/route.int-test.ts` as
a NEW file. But the existing pattern is one consolidated file at
`apps/web/src/app/api/v1/auth/mobile/route.int-test.ts` with a
separate `describe` block per endpoint (start / callback / exchange
/ refresh). Consolidated to match — added the `describe('/api/v1/auth/mobile/revoke')`
block with six tests plus a 7th cross-endpoint reuse-detection
test that exercises the "predecessors are covered by /refresh's
reuse-detection at first attempt" design claim from SPEC §1 / §7.1.

**Triage (filled at close-out):** spec-deviation #3 — added.

---

### 2026-05-22 16:29 — Skipped explicit 429 rate-limit test for /revoke

**Step:** Step 4 (write route int-test)
**Type:** deviation
**Note:**

SPEC §3 AC #17 + §9 case (e) call for a 429 rate-limit test. Skipped
explicitly because: (a) the existing `/refresh` route int-test in the
same file has no 429 test for the same reason; (b) the rate-limit
machinery is shared across all four endpoints via
`apps/web/src/app/api/v1/auth/mobile/_lib/with-rate-limit.ts` and
has its own thorough int-test at
`apps/web/src/infrastructure/db/repositories/drizzle-auth-rate-limit-repository.int-test.ts`;
(c) the /revoke wiring (`endpoint: 'revoke'`) is identical in shape
to the three existing endpoints. The cross-endpoint round-trip tests
serve as the meaningful new coverage in this slice.

**Triage (filled at close-out):** spec-deviation #4 — added.

---

### 2026-05-22 16:40 — Phase C transitional bridge (added scope vs. spec)

**Step:** Phase C wrap-up (after step 12)
**Type:** decision
**Note:**

After step 12 landed the new `AuthProvider`, the type-check broke
in `app/index.tsx` (slice-6 sign-in screen used the old
`SignInResult.email` shape and the now-removed `apiGet`/`storeTokens`
deps). Constitution §10 requires every commit to leave the
codebase in a working state — type-check must pass.

Rather than rolling the route restructure into Phase C (which
would have made the commit enormous), added a transitional bridge:

- Wrapped `app/_layout.tsx` in `<AuthProvider>` (without the guard
  effect — guard is Phase D).
- Updated `app/index.tsx` to consume `useAuth()` and call
  `await auth.signIn(result.tokens)` on success, then navigate to
  `/signed-in`.
- Updated `app/signed-in.tsx` to read email from `useAuth().me.email`
  (was: search params).
- Adjusted the two `__tests__/app/*.test.tsx` files for the new
  shape.

Phase D then did pure route restructure on top: `git mv` the files
into `(auth)/(app)` groups, replace `app/_layout.tsx` with the
full AuthGuard wiring, delete `signed-in.tsx`, write the real
`(app)/index.tsx` me screen. The bridge made Phase D a 100%
mechanical restructure with no design decisions inside it.

**Triage (filled at close-out):** post-impl-note (process / sequencing
learning, not a design deviation).

---

### 2026-05-22 16:45 — `expo-splash-screen` not actually a transitive dep

**Step:** Step 13 (route restructure / root layout)
**Type:** surprise
**Note:**

SPEC §6 prerequisites + §7.3 design said `expo-splash-screen`
was "already a transitive dep via Expo." Wrong — `pnpm exec expo
install expo-splash-screen` had to add `~31.0.13` to the mobile
package. Adds one entry to `apps/mobile/package.json`'s deps.

Used `expo install` rather than `pnpm add` so SDK-version pinning
matches Expo's bundled-native-modules manifest for SDK 54.

**Triage (filled at close-out):** spec-deviation #5 — added.

---

### 2026-05-22 16:46 — `fireEvent.press()` over `element.props.onPress()`

**Step:** Step 11 (AuthProvider tests) + step 15 (me screen tests)
**Type:** learning
**Note:**

Initial test pattern called `screen.getByTestId('x').props.onPress()`
directly to fire Pressable handlers. This fails — RNTL doesn't
surface `onPress` as a queryable prop on the resulting fiber. The
correct API is `fireEvent.press(element)`. Replaced 5 call sites
in `auth-context.test.tsx` and used `fireEvent.press` from the start
in the me-screen test. Documented in `apps/mobile/AGENTS.md`'s
"Component testing" section so future test authors don't repeat.

**Triage (filled at close-out):** post-impl-note (RNTL ergonomics
learning, surfaces in AGENTS.md).

---

### 2026-05-22 16:47 — `apiPost<T = undefined>` schema-optional widening

**Step:** Step 6 (extend apiClient for 204)
**Type:** decision
**Note:**

SPEC §7.3 anticipated the apiPost signature change to
`<T = undefined>` with an optional `responseSchema?` parameter,
including the call shape in `signOut()`. Implemented exactly as
specified. All existing slice-6 callers that pass a schema continue
to work; new `/revoke` caller in `AuthProvider.signOut` omits the
schema. Type-check + all existing tests green.

**Triage (filled at close-out):** discarded — spec-anticipated, no
deviation, no surprise. Implementation followed SPEC §7.3 exactly.

## Close-out triage summary

| Entry | Landed in |
|-------|-----------|
| 1 — Use case test as `.int-test.ts` not `.test.ts` | Spec deviation #1 |
| 2 — Crypto `sha256Base64url` not `hashRefreshToken` | Spec deviation #2 |
| 3 — Route int-test consolidated file | Spec deviation #3 |
| 4 — Skipped 429 rate-limit test | Spec deviation #4 |
| 5 — Phase C transitional bridge sequencing | Spec post-impl-note |
| 6 — `expo-splash-screen` needed explicit install | Spec deviation #5 |
| 7 — `fireEvent.press()` over `props.onPress()` | Spec post-impl-note + AGENTS.md update |
| 8 — `apiPost<T = undefined>` schema-optional | Discarded (spec-anticipated) |
