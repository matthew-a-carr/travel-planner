# Implementation Notes — SPEC-004: Mobile OAuth Endpoints

**Spec:** [SPEC-004-mobile-oauth-endpoints](../specs/SPEC-004-mobile-oauth-endpoints.md)
**Started:** 2026-05-20

> Rolling log written by the implementing agent. Append new entries at the
> bottom as they happen — do not rewrite history. Each entry is a single
> observation, decision, or surprise. At spec close-out, every entry is
> triaged into one of: spec deviations table, spec post-implementation notes,
> docs/tech-debt.md, or discarded.

## Entries

### 2026-05-20 17:07 — Step 1 (schemas + migration) landed clean

**Step:** Step 1 — Drizzle schemas + migration
**Type:** decision
**Note:**

Migration `drizzle/0014_freezing_ultimates.sql` generated cleanly. All
four tables (`mobile_auth_states`, `mobile_auth_exchange_codes`,
`refresh_tokens`, `auth_rate_limit_attempts`) match SPEC-004 §7
verbatim. One small judgment call: used a **partial index** for the
"active refresh chain head" lookup
(`WHERE revoked_at IS NULL AND replaced_by_id IS NULL`) instead of a
plain composite index. Drizzle's index DSL with `.where(sql\`…\`)` is the
canonical Drizzle-supported pattern; produces a small, hot lookup
index that doesn't include revoked or rotated rows. Worth mentioning
because the spec didn't explicitly call out the partial-index variant
— just said "(user_id, revoked_at) partial for active-chain lookups."
This honours the intent.

Migration policy check passed. Full existing integration suite
(45 files, 230 tests) green against the new schema — confirms no
breakage from adding the FK to `users` cascade.

**Triage (filled at close-out):**

---

### 2026-05-20 17:34 — Step 6 (route handlers) done

**Step:** Step 6 — Route handlers (4 endpoints)
**Type:** decision
**Note:**

Four route handlers under `apps/web/src/app/api/v1/auth/mobile/`:
- `start/route.ts` — POST, zod parses `code_challenge`, returns
  `{ authorise_url, state }`.
- `callback/route.ts` — GET, **always** returns 302 to a
  `travelplanner://auth?...` deep link. Never JSON — UA is the
  system browser, not the app. Missing `code`/`state` →
  `?error=invalid_request`.
- `exchange/route.ts` — POST, maps `invalid_exchange_code` → 400,
  `pkce_mismatch` → 400, happy path returns
  `{ access_token, refresh_token, access_expires_at }`.
- `refresh/route.ts` — POST, maps `refresh_reused` / `refresh_expired`
  / `refresh_revoked` / `refresh_unknown` → 401 with the matching
  envelope code. Sentry observer hook left empty (step 8 wires it).

Extended `ApiErrorCode` union in `src/app/api/v1/_lib/errors.ts`
with six new codes + their HTTP status mappings. Updated
`errors.test.ts` table. Per ADR 050, status codes follow the
documented mapping (validation → 400; bearer/refresh failures → 401).

Small helper `_lib/redirect-uri.ts` derives the Google redirect URI
from the request URL — single source of truth between `start` and
`callback`.

Route int-tests in `src/app/api/v1/auth/mobile/route.int-test.ts` — 9
HTTP-shaped scenarios proving envelope shape, status codes, and
container wiring. Use cases are already covered by deeper int-tests
in the use-case dir, so these stay focused on the HTTP layer.

**Triage (filled at close-out):**

---

### 2026-05-20 17:30 — Step 5 (DI wiring) done

**Step:** Step 5 — Container wiring + guard tests
**Type:** decision
**Note:**

`AppContainer` gains six new keys: four mobile-auth repos +
`mobileAuthCrypto` + `googleOAuthClient`. `createAppContainer`
constructs `FetchGoogleOAuthClient` with `AUTH_GOOGLE_ID` /
`AUTH_GOOGLE_SECRET` from `process.env`. Real implementation in
`src/infrastructure/auth/google-oauth-client.ts` hits Google's HTTPS
endpoints directly; FakeGoogleOAuthClient (already in
`src/infrastructure/testing/`) is used by the use-case int-tests.

`container.test.ts`'s `createFakeContainer` helper extended with
the six new keys. Composition-root guard tests pass — no rogue
`new Drizzle*Repository(...)` constructions outside the approved
file.

**Triage (filled at close-out):**

---

### 2026-05-20 17:28 — Step 4 (use cases) done; pre-locked refresh peek decision

**Step:** Step 4 — Use cases (4 of them)
**Type:** decision
**Note:**

Four use cases via factory functions (`make<UseCase>(deps) → fn`):
- `start-mobile-auth` — random `state`, persist with code_challenge, ask
  fake Google client for an authorise URL.
- `handle-mobile-callback` — state→exchange→ADR 029 access check→deep
  link. Always-redirect-to-deep-link policy means even errors carry
  `?error=…` rather than a JSON envelope (UA is the system browser,
  not the app).
- `exchange-mobile-code` — code lookup→PKCE compare→consume→mint
  refresh + access. Deliberately does NOT consume the row on
  `pkce_mismatch` so a legitimate retry within TTL still works.
- `refresh-mobile-tokens` — peek first (catches revoked/expired/unknown
  without holding the FOR UPDATE lock); then call `rotate()` for the
  rotate vs reuse branch. Reuse path calls `onChainRevoked` callback
  (defaults to no-op; step 8 wires Sentry).

Real `MobileAuthCrypto` (web crypto + jose) lives in
`src/infrastructure/auth/mobile-auth-crypto.ts`. Reuses
`signAccessToken` from SPEC-002's bearer-token helper so JWT signing
machinery is identical between cookie and mobile-bearer paths.

Test infra: `FakeGoogleOAuthClient` in
`src/infrastructure/testing/fake-google-oauth-client.ts` lets each
test program `exchangeAuthCode`'s outcome and inspect the call
sequence. Never hits real Google.

18 use-case integration tests across 4 files; type-check + lint
clean. All running against the same Testcontainers Postgres as
existing tests — no new infra dep.

**Triage (filled at close-out):**

---

### 2026-05-20 17:20 — Step 3 (repos) done

**Step:** Step 3 — Repository interfaces + Drizzle impls
**Type:** decision
**Note:**

Four interfaces in `src/domain/auth/`:
- `mobile-auth-state-repository.ts`
- `mobile-auth-exchange-code-repository.ts`
- `refresh-token-repository.ts` — `rotate()` is the load-bearing op,
  contract requires transactional `SELECT … FOR UPDATE` semantics.
- `auth-rate-limit-repository.ts` — `recordAndCount()` does insert +
  windowed count in a single transaction; `gcOlderThan()` for explicit
  pruning if the opportunistic GC ever proves insufficient.

Four Drizzle impls + four `*.int-test.ts` files. 18 integration tests
covering happy paths, lookups, idempotent revoke, GC, sliding-window
correctness, and — critically — the concurrent-rotation test that
fires two `rotate()` calls in `Promise.all` against the same hash and
asserts the outcomes are exactly `['reused', 'rotated']`. The
`SELECT … FOR UPDATE` lock serialises them as ADR 051 §2 requires.

Small infrastructure decisions:
- `truncateAll()` in `src/infrastructure/testing/helpers.ts` extended
  with the four new tables so `beforeEach` clears them.
- Inline-walked the chain inside the transaction in `rotate()` (rather
  than a private helper) because the `tx` type from Drizzle's
  `transaction` callback isn't the same as the top-level `Db` type —
  inlining avoided dragging a `PgTransaction<…>` generic through the
  helper signature.

**Triage (filled at close-out):**

---

### 2026-05-20 17:12 — Step 2 (domain) done; PKCE Result-type narrowing

**Step:** Step 2 — Domain PKCE + rotation logic
**Type:** decision
**Note:**

Two pure modules in `src/domain/auth/`:

- `pkce.ts` — constant-time string compare for the S256 challenge.
  Application layer computes the SHA-256 (async, Web Crypto) and
  passes both base64url strings to the domain. Constant-time loop
  prevents timing attacks on the verifier.
- `refresh-token-rotation.ts` — pure `decideRotation` that takes the
  presented row + the forward chain and returns one of five tagged
  outcomes (`rotate`, `unknown_token`, `expired`, `revoked`,
  `reused`). Precedence: `reused` wins over `expired`/`revoked` —
  attacker holding an expired-but-rotated token still triggers chain
  revocation (covered by the "prioritises reused over expired" test).

15 unit tests across both files; type-check + architecture tests
green.

Small TS papercut: `err<'pkce_mismatch'>('pkce_mismatch')` didn't
narrow because the existing `err` helper signature widens E to
`string` via the `E = string` default in some inference contexts.
Worked around by defining a `MISMATCH: PkceMatchResult` constant
inside the module rather than calling `err()`. Other domains use
`ok()`/`err()` happily because their generic constraints are looser
(`Result<T, string>`-shaped). Not worth widening the shared helpers
for one consumer — local constant is fine.

**Triage (filled at close-out):**

---

## Close-out triage summary

Triaged 2026-05-20 at SPEC close-out. Every step's note retained
verbatim above as the raw record.

| Entry | Landed in |
|-------|-----------|
| Step 1 — partial-index design call | Spec design (Storage & migrations); discarded after merge into design (no deviation) |
| Step 2 — PKCE Result-type narrowing | Spec deviation #3 (kept locally; not worth widening shared helpers) |
| Step 3 — chain-walk inlined inside transaction | Post-impl note (learning about `tx` typing); no deviation |
| Step 4 — peek-before-lock on refresh | Spec deviation #2 (two RTTs on happy path; acceptable trade-off) |
| Step 4 — separate `mobile_auth_states` table | Spec deviation #1 (additive, cleaner than nullable columns) |
| Step 5 — DI wiring | Discarded (mechanical wiring, no deviation) |
| Step 6 — `ApiErrorCode` extension | Post-impl note (canonical home for new codes); no deviation |
| Step 7 — Postgres rate-limit thresholds | Codified by ADR-054; no deviation |
| Step 8 — Sentry chain-revoke event | Spec acceptance #9 satisfied; no deviation |
