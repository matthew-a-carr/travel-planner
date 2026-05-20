# SPEC-004: Mobile OAuth Endpoints (`/api/v1/auth/mobile/*`)

**Date:** 2026-05-20
**Status:** Complete
**Author:** Matt Carr (with Claude Opus 4.7 via `plan-feature` + `grill-me`)
**Approved by:** Matt Carr, 2026-05-20
**Completed:** 2026-05-20
**Parent epic:** [EPIC-001 — iOS App](../epics/EPIC-001-ios-app.md) — slice 3

---

## 1. Summary

Ship the four `/api/v1/auth/mobile/*` endpoints (start / callback /
exchange / refresh), the two new tables that back them
(`mobile_auth_exchange_codes`, `refresh_tokens`), the Postgres
sliding-window rate-limit table (`auth_rate_limit_attempts`), and a
new ADR codifying the rate-limit policy. ADR 051 already settled the
auth model (HS256 access tokens, opaque rotating refresh tokens,
reuse-detection chain revocation); this slice ships the *server-side
endpoints* that issue and rotate those tokens. Mobile client
consumption (UI, Keychain, deep-link plumbing) is slice 6, not in
scope here.

When this lands, a curl-driven end-to-end PKCE round-trip against the
running server (or a Testcontainers-backed integration test) walks
through Google's authorise URL, lands in `/callback`, mints a one-time
exchange code, redirects to a `travelplanner://` URL, and the
following `/exchange` POST returns a usable access + refresh pair.
The author can sign in to the existing `GET /api/v1/me` endpoint
(SPEC-001) with the bearer token issued by this flow.

## 2. Motivation

EPIC-001 §7 slice 3: ship the server-side half of the mobile auth
flow so slice 6 (sign-in UI + Keychain on iOS) has something to call
into. Inherited from EPIC-001 §10 (no re-litigation):

- PKCE → 15m HS256 access tokens + 30d opaque rotating refresh tokens
  with reuse detection; tokens stored in iOS Keychain via
  `expo-secure-store` on the client side (slice 6).
- New `refresh_tokens` table via **generated** Drizzle migration (ADR
  018), not `db:push`.
- Closed-auth policy (ADR 029) applies — Google sign-in success is
  necessary but not sufficient; users must also be pre-provisioned and
  approved.
- Edge rate-limiting on `/api/v1/auth/mobile/*` is in-scope for this
  slice; per-user rate limits on authenticated `/api/v1/*` stay
  deferred per epic §10.
- `/api/v1/auth/*` is excluded from the proxy/middleware matcher and
  handles its own envelope shape per ADR 050.

ADR 051 settled the model and table-shape design. This SPEC settles
the operational details: where the one-time exchange code lives,
exactly how rate-limiting works, which Google OAuth client to use,
race handling on refresh, and the unapproved-user UX.

## 3. Acceptance criteria

1. **Happy path round-trip.** Given a freshly seeded test DB with one
   approved user, when an integration test sequences
   `POST /auth/mobile/start` → simulated Google callback to
   `GET /auth/mobile/callback?code=…&state=…` → `POST /auth/mobile/exchange`
   with the deep-linked one-time code + matching `code_verifier`,
   then the exchange response is `200 OK` with body
   `{ access_token, refresh_token, access_expires_at }`, the access
   token verifies against `AUTH_JWT_SIGNING_KEY`, and a row in
   `refresh_tokens` matches the sha256 of the returned refresh token.
2. **Refresh rotation.** Given a valid refresh token, when
   `POST /auth/mobile/refresh` is called with it, then the response
   contains a new pair, the old refresh row's `replaced_by_id`
   points at the new row, and the old refresh token no longer
   authorises further refreshes.
3. **Reuse detection.** Given a refresh token already used to rotate
   once, when it is presented again to `/refresh`, then the response
   is `401 refresh_reused`, AND every row in the chain (walk
   `replaced_by_id` forward from the presented token) has
   `revoked_at` set, including the currently-active refresh.
4. **PKCE mismatch.** Given a one-time exchange code paired with a
   `code_verifier` whose S256 hash does **not** match the stored
   `code_challenge`, when `/exchange` is called, then the response is
   `400 pkce_mismatch` and the exchange code is **not** marked
   consumed (so a legitimate retry within TTL still works).
5. **Consumed code.** Given an exchange code with `consumed_at IS NOT
   NULL`, the second `/exchange` call returns `400 invalid_exchange_code`.
6. **Expired code.** Given an exchange code older than 120s
   (`expires_at < now()`), `/exchange` returns `400 invalid_exchange_code`
   and the row is not consumed.
7. **Unapproved user.** Given a Google account whose email maps to a
   `users` row with `is_approved = false` (or no row at all), when
   `/callback` runs, then the redirect target is
   `travelplanner://auth?error=access_denied`, no `mobile_auth_exchange_codes`
   row is persisted, and no Google profile info leaks in the
   redirect.
8. **Rate-limit breach.** Given 30 successful `/auth/mobile/start` hits
   from the same IP within the last 5 minutes, the 31st hit (within
   the window) returns `429 rate_limited` with the standard error
   envelope. Sliding window — the 31st succeeds once the oldest of
   the 30 ages out.
9. **Sentry on chain revocation.** Given a reuse-detection trigger,
   Sentry receives a `warning`-level event tagged
   `auth.refresh.chain_revoked` with anonymised user id and chain
   length.
10. **Error envelope conformance.** Every error response on every
    endpoint matches the ADR 050 envelope shape `{ error: { code,
    message, details? } }`.
11. **Migration policy.** `pnpm db:check:migrations` passes (no
    `BEGIN;` / `COMMIT;` in deploy migrations per ADR 018); migration
    is generated via `db:generate`, not `db:push`.

## 4. Demo script

1. From a fresh clone, `pnpm install && pnpm dev` boots the web app.
2. `pnpm db:migrate` applies the new tables (`refresh_tokens`,
   `mobile_auth_exchange_codes`, `auth_rate_limit_attempts`).
3. With Google OAuth credentials in `.env.local` and an approved
   user seeded, run the slice's exemplar curl script
   (`docs/operations/spec-004-curl-demo.sh`):
   - `POST /api/v1/auth/mobile/start` returns
     `{ authorise_url, state }`.
   - Open `authorise_url` in a browser, sign in as the approved user,
     accept Google's consent. Browser lands on `/auth/mobile/callback`
     and gets redirected to `travelplanner://auth?code=<one-time>`.
   - Copy the one-time `code`. Run `POST /api/v1/auth/mobile/exchange`
     with `{ code, code_verifier }`. Response is the access + refresh
     pair.
   - `curl /api/v1/me` with the access token → returns the approved
     user's profile (proves SPEC-001 + SPEC-002 integration).
   - `POST /api/v1/auth/mobile/refresh` with the refresh → new pair;
     old refresh now 401s.
4. Run the integration test suite — all eight scenarios pass.
5. Show Sentry's project dashboard with a synthetic
   `auth.refresh.chain_revoked` event from the reuse-detection test.

## 5. Out of scope

- Mobile client UI / sign-in screen / Keychain plumbing — slice 6.
- Universal Links / `apple-app-site-association` — we use custom
  `travelplanner://` scheme, no universal links needed (logged in
  EPIC §14 parking lot).
- Sign-out-everywhere API — v1 sign-out (slice 7) just deletes the
  current refresh chain.
- Real iOS-type Google OAuth client + on-device Expo Auth Session
  — captured as TD-004; tracked for EPIC-002.
- `kid` header / dual-signing-key acceptance for zero-downtime JWT
  rotation — ADR 051 §6 future ADR.
- RS256 / asymmetric signing — ADR 051 §7.
- Idempotent grace window on refresh race — deferred until strict
  rejection demonstrably bites in practice (Sentry data will tell us).
- Per-user rate limit on authenticated `/api/v1/*` endpoints —
  EPIC §10 deferred to a later ADR / EPIC-002.
- Multi-device concurrent sessions — each device gets its own refresh
  chain naturally; no special handling.

## 6. Prerequisites

- [ ] SPEC-001 (REST conventions + `GET /api/v1/me`) Complete ✓
- [ ] SPEC-002 (bearer token verification + `requireAuth`) Complete ✓
- [ ] EPIC-001 approved ✓
- [ ] An entry for `https://<env-host>/api/v1/auth/mobile/callback` is
      added to the **Authorised redirect URIs** of the existing
      `AUTH_GOOGLE_ID` Google OAuth client in Google Cloud Console,
      for each of: local dev (`http://localhost:3000/...`), preview
      (Vercel preview domain wildcard), and production. **Manual
      step; cannot be automated.**
- [ ] `AUTH_JWT_SIGNING_KEY` provisioned in every environment (already
      done in SPEC-002).
- [ ] Sentry project access — for slice 9, but this slice writes the
      first events that slice 9 will dashboard.

## 7. Design

### Data & domain

Three new tables, all in `apps/web/src/infrastructure/db/schema/`:

**`refresh_tokens`** — designed in ADR 051 §2:

```ts
{
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull().references(() => users.id),
  tokenHash: text('token_hash').notNull().unique(), // sha256(cleartext)
  issuedAt: timestamp('issued_at', { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  replacedById: uuid('replaced_by_id').references((): AnyPgColumn => refreshTokens.id),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
}
```

Indexes: `token_hash` (unique already), `user_id`, `(user_id,
revoked_at)` partial for active-chain lookups.

**`mobile_auth_exchange_codes`** — new:

```ts
{
  id: uuid('id').primaryKey().defaultRandom(),
  codeHash: text('code_hash').notNull().unique(), // sha256(cleartext)
  codeChallenge: text('code_challenge').notNull(), // S256 challenge from /start
  userId: text('user_id').notNull().references(() => users.id),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  consumedAt: timestamp('consumed_at', { withTimezone: true }),
}
```

Index: `code_hash` (unique), `expires_at` for opportunistic GC.

**`auth_rate_limit_attempts`** — new:

```ts
{
  id: uuid('id').primaryKey().defaultRandom(),
  key: text('key').notNull(),       // e.g. "ip:1.2.3.4" or "ip:1.2.3.4#endpoint:start"
  endpoint: text('endpoint').notNull(),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
}
```

Index: `(key, occurred_at desc)` for sliding-window scans.

Domain types in `src/domain/auth/`:
- `RefreshToken` value object (no JS class, plain readonly record);
  domain `Result<RotateOk, RotateErr>` for rotation.
- `ExchangeCode` value object; `Result<ExchangeOk, ExchangeErr>` for
  the exchange operation.
- `RateLimitDecision` = `'allowed'` | `'blocked'` plus current count
  and oldest-in-window timestamp (for `Retry-After` header
  computation).

No domain logic depends on infra; reuse-detection is a pure function
of the rotation chain (`refreshTokens` rows) which the use case loads.

### Behaviour

Use cases in `src/application/use-cases/auth/mobile/`:

- `startMobileAuth({ codeChallenge }) → { authoriseUrl, state }` —
  generates `state` (32 bytes base64url), stashes
  `{ state, codeChallenge }` in a short-lived map (Postgres? see
  §Storage below — actually inline in `mobile_auth_exchange_codes`'s
  pre-callback row, see notes), returns Google authorise URL.
- `handleMobileCallback({ code, state }) → { redirectUrl }` —
  validates state, exchanges Google code → profile via existing
  next-auth Google provider helpers, runs `assertCanSignIn` (ADR 029)
  on the resolved email, mints one-time `code` (32 bytes base64url),
  inserts `mobile_auth_exchange_codes` row, returns
  `travelplanner://auth?code=<code>` (or `?error=access_denied`).
- `exchangeMobileCode({ code, codeVerifier }) → { accessToken, refreshToken, accessExpiresAt }`
  — verifies S256 hash matches stored `code_challenge`, marks
  consumed, mints + persists refresh, signs access JWT.
- `refreshMobileTokens({ refreshToken }) → { accessToken, refreshToken, accessExpiresAt }`
  — `SELECT … FOR UPDATE` on `token_hash`, branch on
  `replaced_by_id IS NULL` (rotate) vs `IS NOT NULL` (revoke chain,
  return 401 reuse).

Route handlers in `apps/web/src/app/api/v1/auth/mobile/{start,callback,exchange,refresh}/route.ts`
are thin: parse body (zod), resolve container, call use case, map
`Result` to envelope per ADR 050.

State for `start → callback` (the `state` and `codeChallenge` pair)
piggybacks on `mobile_auth_exchange_codes` with a `nullable user_id`
column would be ugly. Cleaner: a tiny separate `mobile_auth_states`
table or inline columns on the same exchange-code table populated
after callback. **Decision: separate `mobile_auth_states` table.**
Added as a fourth migration:

```ts
{
  id: uuid('id').primaryKey().defaultRandom(),
  state: text('state').notNull().unique(),
  codeChallenge: text('code_challenge').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  consumedAt: timestamp('consumed_at', { withTimezone: true }),
}
```

(120s TTL, single-use, opportunistic GC on insert.)

### Storage & migrations

One migration generated via `pnpm db:generate` containing all four
tables. No backfill — these are new tables. Migration runs as part
of Vercel's deploy gate per ADR 018; no transactional wrapper needed
(Drizzle generates pure DDL by default).

Rollback: `DROP TABLE` each of the four. No data loss for existing
users (they're not in any of these new tables until they sign in via
mobile). The `users` table is unchanged.

### External integrations

Google OAuth via the existing web `AUTH_GOOGLE_ID` client. New
Authorised Redirect URI to register:
`https://<host>/api/v1/auth/mobile/callback` for dev / preview /
prod. No new Google client; the iOS-type client transition is
deferred to EPIC-002 via TD-004.

No retries / circuit breakers — Google's OAuth endpoint is
synchronous and rare (per-sign-in). If it 500s, the user sees the
access-denied screen and retries.

### UI / UX

N/A — slice 3 is server-side only. Slice 6 owns the mobile UI.

## 8. Security & data considerations

- **Threats considered:**
  - Stolen refresh token → reuse-detection + chain revocation (ADR 051 §2).
  - Stolen access token → bounded by 15m TTL (ADR 051 §1).
  - Stolen exchange code → bounded by 120s TTL + single-use +
    PKCE binding (S256).
  - CSRF on callback → `state` parameter binding.
  - Open redirect on callback's `?error=` branch → redirect target
    hard-coded to `travelplanner://auth`, never user-supplied.
  - Account enumeration on unapproved-user — `?error=access_denied`
    is identical whether the user exists-but-unapproved or doesn't
    exist at all; no profile data leaks.
  - Brute-force on the four endpoints → Postgres sliding-window
    rate limit (ADR 054).
  - DoS via rate-limit table growth → opportunistic GC + capped
    window.
  - Signing-key rotation → ADR 051 §6 procedure unchanged; this
    SPEC adds no new exposure.

- **Mitigations:** as above. No new PII flows; the `users` table
  stays the single profile source.

- **Secrets needed:** `AUTH_JWT_SIGNING_KEY` (already provisioned),
  `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` (already provisioned).
  Nothing new.

- Tokens (cleartext access + refresh) are never logged. Hashes only
  in DB. Sentry breadcrumbs scrub the `Authorization` header by
  default; verify in `apps/web/sentry.server.config.ts`.

## 9. Test plan

Tests are written **before** implementation per CONSTITUTION.md §3.

### E2E (Playwright)

N/A — no UI in this slice. EPIC §10 says slice 1's REST conventions
include integration-tests-only as the test strategy for `/api/v1/*`
slices; no Playwright runs for the auth endpoints themselves.

### Integration (Vitest + Testcontainers)

| Test file | What it covers |
|-----------|----------------|
| `src/app/api/v1/auth/mobile/start/route.int-test.ts` | Happy path, missing `code_challenge`, malformed `code_challenge`, rate-limit breach |
| `src/app/api/v1/auth/mobile/callback/route.int-test.ts` | Happy path with approved user, `state` not found / expired / consumed, unapproved user → `?error=access_denied`, Google error response |
| `src/app/api/v1/auth/mobile/exchange/route.int-test.ts` | Happy path mints JWT + persists refresh row; PKCE mismatch; consumed code; expired code; rate-limit breach |
| `src/app/api/v1/auth/mobile/refresh/route.int-test.ts` | Rotation happy path; reuse-detection chain revocation (verifies every `revoked_at`); expired refresh; unknown refresh; rate-limit breach per-user |
| `src/application/use-cases/auth/mobile/refresh-mobile-tokens.int-test.ts` | Concurrent-refresh `SELECT … FOR UPDATE` semantics |
| `src/application/use-cases/auth/mobile/rate-limiter.int-test.ts` | Sliding window correctness, GC behaviour |

The Google OAuth call is mocked at the repository boundary
(`GoogleOAuthClient` interface). Real Google is exercised manually
in §4's demo script.

### Unit (Vitest)

| Test file | What it covers |
|-----------|----------------|
| `src/domain/auth/refresh-token-rotation.test.ts` | Pure logic of chain walking + revocation; reuse classification |
| `src/domain/auth/pkce.test.ts` | S256 verification of `code_verifier` against `code_challenge` |
| `src/application/auth/mint-access-token.test.ts` | Existing helper from SPEC-002 — extend with refresh-issuance helper |

### Manual checks

- Real Google OAuth round-trip in dev environment with a real Google
  account.
- Sentry receives the `auth.refresh.chain_revoked` event when reuse
  is forced manually via the curl script.
- Google Cloud Console redirect URI list contains all three
  environments after manual provisioning.

## 10. Observability

- **Logs (structured, Pino via existing infra logger):**
  - `auth.mobile.start.success`, `auth.mobile.start.rate_limited`
  - `auth.mobile.callback.success`, `auth.mobile.callback.access_denied`,
    `auth.mobile.callback.state_invalid`
  - `auth.mobile.exchange.success`, `auth.mobile.exchange.pkce_mismatch`,
    `auth.mobile.exchange.expired`, `auth.mobile.exchange.consumed`
  - `auth.mobile.refresh.success`, `auth.mobile.refresh.reused`
- **Metrics:** none added in this slice; logs are queryable via Vercel.
- **Sentry events:**
  - `auth.refresh.chain_revoked` — warning, includes anonymised user
    id, chain length, time-since-issue of replayed token.
  - `auth.mobile.rate_limited` — info, includes key prefix
    (`ip:` or `user:`) and endpoint.
  - All caught route-handler errors flow through the existing
    `apps/web/src/app/api/v1/_lib/errors.ts` Sentry pipeline.

## 11. Rollback / safety

- **Migration:** four new tables, all empty at deploy time. Rollback
  is `DROP TABLE` × 4. No existing-row impact.
- **Endpoints:** entirely new. Reverting the deployment removes them.
  No client depends on them yet (slice 6 hasn't shipped).
- **Cookie sessions on web:** unchanged. Reverting this slice does
  not affect web sign-in.
- **Feature flag:** none. The endpoints simply don't exist until
  this ships and the migration runs.

## 12. Implementation order

Tests-first per CONSTITUTION.md §3. Each step ≤ ~150 LOC + tests
and commits independently.

1. [ ] **Drizzle schemas + migration.** Add the four new tables to
   `src/infrastructure/db/schema/`; run `pnpm db:generate`; verify
   `pnpm db:check:migrations` passes. **Verification:** migration
   file exists, `pnpm db:migrate` against a Testcontainers DB
   succeeds, schema introspection matches the spec.
2. [ ] **Domain — PKCE S256 verification + refresh-rotation logic.**
   Write pure functions in `src/domain/auth/` with unit tests first.
   **Verification:** `pnpm test:unit -- pkce` and
   `refresh-token-rotation` pass.
3. [ ] **Repository interfaces + Drizzle implementations.** New
   interfaces in `src/domain/auth/repositories/` for
   `MobileAuthStateRepository`, `MobileAuthExchangeCodeRepository`,
   `RefreshTokenRepository`, `AuthRateLimitRepository`. Drizzle impls
   in `src/infrastructure/db/repositories/`. **Verification:** new
   `*.int-test.ts` repo tests with Testcontainers cover CRUD and the
   `SELECT … FOR UPDATE` semantics for the refresh repo.
4. [ ] **Use cases (no transport).** Implement the four use cases in
   `src/application/use-cases/auth/mobile/` with integration tests
   against Testcontainers. **Verification:** use-case integration
   tests green (happy path + every error path per §9).
5. [ ] **Container wiring.** Register the new repositories in
   `src/infrastructure/container/create-app-container.ts`. Update
   the composition-root guard tests so the new wiring doesn't break
   `src/__tests__/composition-root-boundary.test.ts`.
   **Verification:** existing guard tests still pass.
6. [ ] **Route handlers + zod parsing + envelope mapping.** Four
   thin handlers under `src/app/api/v1/auth/mobile/`. Each one calls
   the matching use case and maps `Result<T, E>` to the ADR 050
   envelope. **Verification:** route-level integration tests green
   (full HTTP surface).
7. [ ] **Rate-limit middleware-as-helper.** Implement a
   `withRateLimit` wrapper used by each handler. **Verification:**
   rate-limit integration tests green; manual `for i in {1..31}; do
   curl …; done` returns 429 on the 31st.
8. [ ] **Sentry instrumentation.** Wire `auth.refresh.chain_revoked`
   and `auth.mobile.rate_limited` events in the corresponding use
   cases. **Verification:** unit test asserts Sentry's mock receives
   the right tags/messages; manual smoke test triggers a real event
   in dev.
9. [ ] **ADR-054 draft + accept.** Write the rate-limit policy ADR
   alongside the implementation, accept after human review.
   **Verification:** ADR landed in `docs/decisions/`, index updated.
10. [ ] **Demo script (`docs/operations/spec-004-curl-demo.sh`).**
    Captures the §4 walk-through as runnable shell. **Verification:**
    script runs end-to-end against a local dev server.
11. [ ] **Final verification suite.** `pnpm lint`,
    `pnpm db:check:migrations`, `pnpm type-check`, `pnpm test:unit`,
    `pnpm test:integration`, `pnpm build` (with dummy POSTGRES_URL).
    **Verification:** all five exit 0.

## 13. ADR triggers and tech-debt review

### ADR?

Review the trigger criteria from `AGENTS.md`:

- [ ] New library, external tool, or vendor — no
- [ ] CI pipeline or workflow structural change — no
- [x] **New project-wide standard** — rate-limit policy on
      `/api/v1/auth/mobile/*` is a project-wide pattern other auth
      endpoints will likely inherit.
- [x] **Non-obvious architectural trade-off** — Postgres-only rate
      limiting over Vercel KV.
- [ ] Cross-cutting decision not already settled by the parent epic
      — no, EPIC §10 settled the broad shape

**ADRs to write:** **ADR-054 — Edge rate-limiting on
`/api/v1/auth/mobile/*` via Postgres sliding-window counter.**

### Tech debt

- [x] I reviewed `docs/tech-debt.md`.

**Tech debt items addressed by this spec:** none.

**Tech debt items this spec creates:**
- **TD-004** — Transition to direct-on-device OAuth via Expo Auth
  Session with an iOS-type Google client. Trigger: EPIC-002 funds
  Apple Developer Program. Severity: Low until ADP is funded;
  Medium once it is.

## 14. Risks & open questions

| Risk | Mitigation |
|------|------------|
| Strict reuse-detection causes false-positive logouts on flaky mobile networks | Sentry on every chain revocation lets us measure. If real-world rate is annoying, add an idempotent grace window in a follow-up PR. |
| Rate-limit table grows unbounded if GC misses | Opportunistic GC on every insert + a one-off cron in EPIC-002 if it proves insufficient. Capped window means scan cost is bounded. |
| Manual Google Cloud Console redirect URI registration drift | Pre-implementation checklist in §6 names it explicitly across dev/preview/prod; AGENTS.md "Doc review" row already covers `/api/v1/*` endpoint changes pointing at this. |
| 120s exchange-code TTL too short on slow networks | Configurable via env var with 120s default; Sentry-log expired-code occurrences to measure. |
| Concurrent-refresh `SELECT … FOR UPDATE` deadlocks under load | Audience-of-two — won't be observed. If it ever becomes real, classic pattern is `SKIP LOCKED` for non-blocking retry. |

No remaining open questions to grill.

---

## Implementation Deviations

> Captured during implementation in
> `docs/implementation-notes/SPEC-004-mobile-oauth-endpoints.md`.
> Triaged here at close-out.

| # | Deviation | Reason | Impact | Resolved? |
|---|-----------|--------|--------|-----------|
| 1 | Added a fourth mini-table `mobile_auth_states` (state + code_challenge stash) alongside the three the spec named. | The spec implied state could piggyback on the exchange-code row, but that gives ugly nullable columns until callback fires. A small dedicated table is cleaner; 120s TTL + single-use + opportunistic GC. | Schema migration grew from 3 → 4 tables. No external-API or call-site changes. | Yes — design improvement, rolled into the spec design section. |
| 2 | `decideRotation` peek before the locked rotate. | The use case peeks the row by hash before calling `RefreshTokenRepository.rotate` so we can catch `expired/revoked/unknown` cheaply without holding a `SELECT FOR UPDATE` lock. The locked path is only entered when the token is plausibly usable. | Two DB round-trips on the happy path instead of one. Acceptable for audience-of-two; can be unified later if it bites. | Yes — captured as a learning. |
| 3 | Refresh-token Result type narrowing required defining `MISMATCH` constant inside `pkce.ts` rather than reusing `err('pkce_mismatch')`. | The shared `err<E>` helper widens to `string` in some inference contexts; a local typed constant compiles without widening shared types. | Local one-liner; no broader impact. | Yes — discarded after locally resolved. |

### Post-Implementation Notes

Slice 3 landed on schedule (within EPIC-001 §7's 4–5d budget) across
11 conventional-commit-sized steps. Key learnings worth carrying into
later slices:

- **Domain ports for crypto pay off.** Bundling `randomBase64url`,
  `sha256Base64url`, `mintRefreshToken`, and `signAccessToken` into
  one `MobileAuthCrypto` port kept use-case constructors readable and
  let the application layer stay strictly free of `jose` / Web Crypto
  imports. Worth repeating for any future slice that mixes signing
  and hashing.
- **Per-request transactions for serialisation.** The refresh-token
  `SELECT … FOR UPDATE` test (concurrent rotation → exactly one
  `rotated` + one `reused`) gave very high confidence in the
  reuse-detection invariant. Worth keeping as a template for any
  future "two clients race the same write" scenario.
- **Always-redirect on callback.** Resisting the urge to return a
  JSON envelope from `/auth/mobile/callback` was the right call —
  the UA there is the system browser, not the app, so JSON would
  hit the user as a wall of text. Same pattern applies to any future
  OAuth-style redirect endpoint.
- **ApiErrorCode extension as the canonical home for new codes.** Six
  new auth-specific codes were added to the union with their status
  mappings. The test pinning the codes-to-status map (`errors.test.ts`)
  is doing real work; it caught the missing entries on the first
  type-check after extending the union.

Followed by 35 new unit tests and 45 new integration tests (across
the repos, use cases, and routes) — no broken existing tests.
