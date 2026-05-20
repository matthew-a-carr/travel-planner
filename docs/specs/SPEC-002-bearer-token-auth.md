# SPEC-002: Bearer-Token Auth Alongside Cookie Sessions + Mobile-Auth Model ADR

**Date:** 2026-05-20
**Status:** Approved
**Author:** Matt Carr (with Claude Opus 4.7 via `plan-feature` + `grill-me`)
**Approved by:** Matt Carr, 2026-05-20
**Parent epic:** [EPIC-001 — iOS App](../epics/EPIC-001-ios-app.md) — slice 2

---

## 1. Summary

Add `Authorization: Bearer <jwt>` as a second credential format that
`/api/v1/*` handlers accept, side-by-side with cookie sessions. JWTs are
HS256-signed; their `sub` claim resolves to the same `User` row that
next-auth resolves cookies to. No mobile issuance yet (slice 3); during
slice 2 we mint test tokens via a small dev CLI. The slice's ADR
records the full mobile-auth model (signing strategy, claim set, TTLs,
refresh-token table design, reuse-detection invariant, Keychain storage)
even though slice 2 ships only the verification half.

## 2. Motivation

EPIC-001's milestone (slice 7) needs the iOS app to call `/api/v1/me`
with a JWT it stored in iOS Keychain. Slice 2 builds the
verification path the iOS app will hit; slice 3 builds the issuance
endpoints the iOS app will exchange a Google OAuth code through.
Splitting verification from issuance halves the risk surface per slice
and keeps each PR small enough to review thoroughly.

Inherited from EPIC-001 §10 (no re-litigation):

- Cookie OR bearer auth on Route Handlers; both resolve to the same
  `User` row; existing ADR 029 access policy applies unchanged.
- PKCE → short-lived JWT access tokens + rotating refresh tokens with
  reuse detection; tokens stored in iOS Keychain via `expo-secure-store`.
- New `refresh_tokens` table introduced via generated Drizzle
  migration (ADR 018), not `db:push`. Schema specifics finalised in
  slice 3's SPEC (which performs the migration); the principle and
  shape live in the ADR drafted here.

## 3. Acceptance criteria

1. Given a request with a valid HS256-signed JWT for an approved user
   in the `Authorization: Bearer …` header, when `GET /api/v1/me` is
   called, then the response is `200 OK` with body
   `{ id, email, name, isApproved: true }` — identical to the cookie path.
2. Given the same with `users.isApproved = false`, the response is `200
   OK` with `isApproved: false`.
3. Given the same with an anonymised user (ADR 031 email marker), the
   response is `410 Gone` with `code: "user_deleted"`.
4. Given a request with an expired JWT (exp in the past), the response
   is `401 Unauthorized` with `code: "unauthenticated"`. No detail leaks.
5. Given a request with a malformed JWT (not three dot-separated
   segments, or invalid base64), the response is `401 Unauthorized`
   with `code: "unauthenticated"`.
6. Given a request with a JWT whose signature does not match
   `AUTH_JWT_SIGNING_KEY`, the response is `401 Unauthorized` with
   `code: "unauthenticated"`.
7. Given a request with **both** a valid cookie session and a valid
   bearer token, the bearer wins — the response reflects the user the
   bearer's `sub` claim identifies, even if the cookie identifies a
   different user.
8. The existing five cookie-path integration tests for `GET /api/v1/me`
   still pass without modification.
9. `pnpm auth:mint-token --email <existing user email>` prints a JWT
   that the running app accepts. `pnpm auth:mint-token` refuses to run
   when `NODE_ENV=production`.
10. `tests/e2e/04-api-me.spec.ts` covers two assertions against a
    running app: cookie-session request → 200; new-context-no-cookies
    request → 401. Both pass in CI.
11. ADR "Mobile Authentication Model" exists in `docs/decisions/` with
    the next available number, status `Accepted`, listed in
    `docs/decisions/README.md`, and documents: HS256 signing rationale,
    `AUTH_JWT_SIGNING_KEY` separation from `AUTH_SECRET`, 15m/30d TTLs,
    `{ sub, iat, exp, iss }` claim set, refresh-token table shape
    (designed, not migrated this slice), reuse-detection invariant,
    Keychain storage on iOS.
12. `docs/api-conventions.md` documents the `Authorization: Bearer`
    format and the bearer-wins-when-both rule.

## 4. Demo script

1. Run `pnpm dev` — local app at `localhost:3000`, local Postgres via
   Testcontainers seeded.
2. In another terminal: `pnpm auth:mint-token --email <seeded local-dev user email>`
   — prints a JWT.
3. `curl -i -H "Authorization: Bearer <jwt>" http://localhost:3000/api/v1/me`
   — see `200` and `{ "id": "...", "email": "...", "name": "...",
   "isApproved": true }`.
4. `curl -i -H "Authorization: Bearer abc.def.ghi"
   http://localhost:3000/api/v1/me` — see `401` and `{ "error": { "code":
   "unauthenticated", "message": "..." } }`. No `boom` or jose
   internals in the body.
5. Wait 16 minutes, repeat step 3 with the same token — see `401`
   (token expired).
6. Open the existing browser session at `localhost:3000`, copy the
   `authjs.session-token` cookie value, then run:
   `curl -i --cookie 'authjs.session-token=...' -H "Authorization:
   Bearer <a fresh JWT for a different user>" http://localhost:3000/api/v1/me`
   — see the response body identifies the **bearer's** user, not the
   cookie's. Bearer-wins is real.
7. `pnpm test:integration -- src/app/api/v1/me/route.int-test.ts` —
   see all 11+ integration tests pass (5 cookie from slice 1 + new
   bearer cases).
8. `pnpm test:e2e -- 04-api-me.spec.ts` — Playwright runs against a
   real app; both assertions green.

## 5. Out of scope

- **Refresh-token issuance, rotation, reuse-detection implementation.**
  Slice 3. The `refresh_tokens` table is _designed_ in this slice's ADR
  but the migration and use-case land in slice 3.
- **PKCE OAuth endpoints** (`/api/v1/auth/mobile/{start,callback,exchange,refresh}`).
  Slice 3.
- **Rate limiting on auth endpoints.** Slice 3 (per EPIC-001 §10).
- **Per-user rate limiting on authenticated endpoints.** v1 unlimited
  per EPIC-001 §10.
- **Token revocation list / blocklist.** 15-minute access TTL is the
  revocation mechanism for v1.
- **Distinct 401 sub-codes** (`token_expired`, `token_invalid`).
  Always `unauthenticated`.
- **`kid` header / dual-signing-key rollover.** Future ADR if
  zero-downtime key rotation becomes required.
- **RS256 / asymmetric signing.** Future ADR; reachable as a
  non-breaking add via `kid`.
- **Playwright e2e for the bearer path.** Integration tests cover it
  more cheaply and cover more branches.
- **CORS headers on `/api/v1/*`.** Cookie + same-origin works for slice
  2. Revisited in slice 3 when mobile-OAuth needs cross-origin
  redirects.
- **Sentry breadcrumbs for jose verification errors.** Console log
  only for now; small follow-up if noise threshold matters.

## 6. Prerequisites

- EPIC-001 status is **Approved** ✅.
- SPEC-001 status is **Complete** ✅ (provides `_lib/auth.ts`,
  `_lib/errors.ts`, `docs/api-conventions.md`).
- `jose` is in the dependency graph (transitively via next-auth — slice
  2 pins it as a direct dep on `apps/web`).
- `AUTH_JWT_SIGNING_KEY` env var available locally (auto-injected by
  `apps/web/scripts/dev.ts`) and documented in `AGENTS.md` / `README.md`.
- Testcontainers + Docker for integration tests; Playwright + Docker
  for e2e — all existing conventions (ADR 009).

## 7. Design

### Data & domain

No new domain types. The `User` shape from
`apps/web/src/infrastructure/db/schema.ts` remains the source of
truth. `AuthResult` (renamed from `CookieSessionResult` in this slice)
is the only shape exposed by the v1 auth helpers.

### Behaviour

**`apps/web/src/infrastructure/auth/bearer-token.ts`:** pure
verification.

```ts
export type VerifiedAccessToken = {
  readonly userId: string;
};

export type AccessTokenError =
  | 'missing'
  | 'malformed'
  | 'signature_invalid'
  | 'expired'
  | 'claims_invalid';

export async function verifyAccessToken(
  jwt: string,
): Promise<{ ok: true; value: VerifiedAccessToken } | { ok: false; error: AccessTokenError }>;

export async function signAccessToken(
  input: { userId: string; ttlSeconds?: number },
): Promise<string>;
```

`verifyAccessToken` uses `jose.jwtVerify` with HS256, the
`AUTH_JWT_SIGNING_KEY` secret, and an `issuer: 'travel-planner-api'`
check. Returns a typed `Result` (the codebase's existing pattern).

`signAccessToken` is exported so the dev CLI and tests can mint
tokens without duplicating the signing config. Production sign-paths
arrive in slice 3.

**`apps/web/src/app/api/v1/_lib/auth.ts`** gains two new exports:

```ts
// existing — unchanged
export async function requireCookieSession(): Promise<AuthResult>;

// new
export async function requireBearerSession(request: Request): Promise<AuthResult>;

// new — bearer wins when both present
export async function requireAuth(request: Request): Promise<AuthResult>;
```

`requireBearerSession` extracts the `Authorization` header, calls
`verifyAccessToken`, looks up the user row (reusing the existing
anonymisation + isApproved branches from `requireCookieSession`),
returns the same `AuthResult` shape.

`requireAuth` checks for an `Authorization: Bearer <…>` header first;
if present, runs `requireBearerSession(request)`. Otherwise falls
back to `requireCookieSession()`.

**`apps/web/src/app/api/v1/me/route.ts`** updated:

```ts
export async function GET(request: Request): Promise<Response> {
  try {
    const session = await requireAuth(request);
    if (!session.ok) return session.response;
    // ... existing 200 path unchanged
  } catch (error) {
    console.error('[api/v1/me] unexpected error', error);
    return respondWithError('internal', 'An unexpected error occurred.');
  }
}
```

One-line change (`requireCookieSession()` → `requireAuth(request)`)
plus the function signature now accepts `request: Request`.

**`apps/web/scripts/mint-token.ts`** — dev CLI.

```ts
// pnpm auth:mint-token --user-id <uuid>  [--ttl 15m]
// pnpm auth:mint-token --email <email>   [--ttl 15m]
```

Refuses to run when `NODE_ENV=production`. Resolves email to userId
via a direct DB lookup. Calls `signAccessToken` and prints the JWT to
stdout (nothing else — pipeable into `curl`).

### Storage & migrations

N/A — no schema change in slice 2. (Refresh-tokens migration lands in
slice 3.)

### External integrations

N/A — `jose` is already a transitive dep; this slice pins it as a
direct dep on `apps/web` for stability (per `vite` precedent in the
recent chore).

### UI / UX

N/A — API-only slice.

## 8. Security & data considerations

- **Threats considered:**
  - **Token theft.** A leaked JWT grants full impersonation for ≤15
    minutes. Mitigated by short TTL + Keychain storage on the mobile
    side (slice 6). No further mitigation in slice 2.
  - **Signature forgery.** Requires the `AUTH_JWT_SIGNING_KEY` secret.
    Stored in Vercel env vars (production) and `.env.local` (dev);
    standard secret handling.
  - **Replay.** Mitigated by `exp` (≤15 min). No nonce/jti in v1.
  - **401 information disclosure.** All bearer failure modes collapse
    to `unauthenticated`; underlying jose error logged to console for
    debug only.
  - **Cookie + bearer present.** Bearer wins; documented and tested.
    Prevents an attacker who injected a bearer header from being
    silently outvoted by a stale cookie.
  - **Anonymised user with valid token.** A user with `email =
    deleted-{id}@anonymized.local` returns 410, identical to the
    cookie path. The token was minted while the user was active; the
    410 ensures the mobile client treats it as a sign-out signal.
  - **Dev CLI in production.** Refusal on `NODE_ENV=production` plus a
    docstring warning. Belt: the CLI requires `AUTH_JWT_SIGNING_KEY`
    to be set, which is a production-only secret an operator must
    deliberately export.
- **Mitigations:**
  - Strict `iss` check in `jwtVerify`.
  - `AUTH_JWT_SIGNING_KEY` documented as a 32-byte+ random base64
    secret (`openssl rand -base64 32`).
  - No internal exception text leaks to clients (existing 500 envelope
    pattern from slice 1).
- **Secrets needed:** `AUTH_JWT_SIGNING_KEY` — new env var in
  `.env.local` (dev default auto-injected by bootstrap), Vercel
  environment (production/preview), and GitHub Actions for CI e2e (no
  bearer tokens used in CI e2e, but the env must be present so the app
  boots without warnings).

## 9. Test plan

Tests written **before** implementation per CONSTITUTION §3.

### E2E (Playwright)

| Test file | Scenario |
|-----------|----------|
| `tests/e2e/04-api-me.spec.ts` | (1) cookie-session request → 200 + body. (2) no-cookie context → 401. |

### Integration (Vitest + Testcontainers)

| Test file | What it covers |
|-----------|---------------|
| `apps/web/src/app/api/v1/me/route.int-test.ts` | Adds 6 new cases on top of slice 1's 6: (a) valid bearer for approved user → 200; (b) valid bearer for unapproved user → 200 + isApproved:false; (c) valid bearer for anonymised user → 410; (d) expired bearer → 401; (e) malformed bearer → 401; (f) bad-signature bearer → 401; (g) cookie + bearer both present → bearer wins. |

### Unit (Vitest)

| Test file | What it covers |
|-----------|---------------|
| `apps/web/src/infrastructure/auth/bearer-token.test.ts` | `verifyAccessToken`: valid token round-trip via `signAccessToken`; expired token (clock-advanced) → `error: expired`; bad-sig (sign with different key) → `signature_invalid`; malformed input (not three segments, not base64) → `malformed`; missing claims (no `sub`) → `claims_invalid`; wrong `iss` → `claims_invalid`. `signAccessToken`: TTL override applied; default TTL = 15 min; output is a parseable JWS. |

### Manual checks

Demo script §4 — manual `curl` with a minted token, expiry walk, and
bearer-wins. No UI / a11y.

## 10. Observability

- **Logs:** `console.error('[api/v1/me] unexpected error', err)`
  unchanged. Add `console.warn('[bearer-token] verify failed', {
  reason })` inside `verifyAccessToken` when verification fails (with
  the categorised reason, not the raw error). Helps diagnose
  401-flood patterns server-side.
- **Metrics:** None new. Existing Vercel + Sentry suffices.
- **Sentry / error reporting:** Auto-instrumented Route Handlers
  capture the 500 path (unchanged from slice 1). No explicit
  `Sentry.captureException` calls.

## 11. Rollback / safety

Slice 2 adds new code paths without changing existing cookie
behaviour. Rollback = revert the merge. Web app unaffected at every
step. No data migration. No env var rename. `AUTH_JWT_SIGNING_KEY`
unset in production simply means bearer endpoints return 500 on any
attempt (caught by the existing `internal` envelope); cookie path
continues to work. Production deploy strategy: set
`AUTH_JWT_SIGNING_KEY` in Vercel before merging.

## 12. Implementation order

1. [ ] **Intent:** Pin `jose` as a direct devDep on `apps/web` and add
   `AUTH_JWT_SIGNING_KEY` env var with safe local default in
   `apps/web/scripts/dev.ts`; document in `AGENTS.md` env section and
   `README.md`. **Verification:** `pnpm dev` boots; `process.env.AUTH_JWT_SIGNING_KEY`
   is set. **Commit:** `chore(auth): pin jose + add AUTH_JWT_SIGNING_KEY env`.

2. [ ] **Intent:** Draft ADR "Mobile Authentication Model" (next free
   ADR number) covering HS256 + dedicated key + 15m/30d + claim set
   + refresh-token table design + reuse-detection invariant +
   Keychain. Status `Proposed`. Update `docs/decisions/README.md`
   index. Update `docs/api-conventions.md` with `Authorization: Bearer`
   format and bearer-wins rule. **Verification:** Self-review against
   §3 acceptance criteria 11 + 12. **Commit:** `docs(auth): adr + conventions update for mobile-auth model`.

3. [ ] **Intent:** Write `bearer-token.test.ts` (failing). Implement
   `bearer-token.ts` with `verifyAccessToken` + `signAccessToken` using
   `jose.SignJWT` / `jose.jwtVerify` with HS256. **Verification:**
   `pnpm test:unit -- src/infrastructure/auth/bearer-token.test.ts`
   green; all branches covered. **Commit:** `feat(auth): JWT access-token signer + verifier`.

4. [ ] **Intent:** Rename `CookieSessionResult` → `AuthResult` in
   `_lib/auth.ts`; update every reference. **Verification:** `pnpm
   type-check` clean; existing integration tests still pass.
   **Commit:** `refactor(api): rename CookieSessionResult to AuthResult`.

5. [ ] **Intent:** Add `requireBearerSession(request)` and
   `requireAuth(request)` to `_lib/auth.ts`. `requireBearerSession`
   parses the `Authorization` header, calls `verifyAccessToken`,
   reuses the user-row-lookup + anonymisation branches via a
   small private helper extracted from `requireCookieSession`.
   `requireAuth` is bearer-first. **Verification:** `pnpm type-check`
   clean. (Integration coverage lands in step 6.) **Commit:** `feat(api): requireBearerSession + requireAuth helpers`.

6. [ ] **Intent:** Migrate `GET /api/v1/me` to `requireAuth(request)`
   (signature change: handler now takes `request: Request`). Extend
   `route.int-test.ts` with 6 new bearer cases. **Verification:**
   `pnpm test:integration -- src/app/api/v1/me/route.int-test.ts`
   green with 12 cases total (5 cookie + 6 bearer + 1 both-present).
   **Commit:** `feat(api): /api/v1/me accepts bearer tokens`.

7. [ ] **Intent:** Add `apps/web/scripts/mint-token.ts` and `pnpm
   auth:mint-token` script entry. Refuses on `NODE_ENV=production`.
   Resolves user by `--user-id` or `--email`. Prints JWT to stdout.
   **Verification:** `pnpm auth:mint-token --email <local-dev user>`
   prints something that round-trips through `verifyAccessToken`.
   **Commit:** `feat(auth): pnpm auth:mint-token dev CLI`.

8. [ ] **Intent:** Add `tests/e2e/04-api-me.spec.ts` with two
   assertions (cookie 200, no-cookie 401). Update `CHANGELOG.md`
   under `[Unreleased]`. Bump ADR status → `Accepted`. Update
   `docs/decisions/README.md`. Update EPIC-001 §7 slice 2 status →
   **Done** and append slice ledger. **Verification:** full
   verification suite + `pnpm test:e2e -- 04-api-me.spec.ts` green;
   `POSTGRES_URL=… pnpm build` succeeds. **Commit:** `feat(api): bearer auth e2e + close slice 2`.

## 13. ADR triggers and tech-debt review

### ADR?

- [x] New library, external tool, or vendor — pinning `jose` as a
      direct dep (was transitive); arguable but worth noting in the
      ADR
- [ ] CI pipeline or workflow structural change — N/A
- [x] **New project-wide standard** — JWT signing model for the API
- [x] **Non-obvious architectural trade-off** — HS256 vs RS256;
      stale-claim avoidance via fresh DB fetch vs token-embedded
      claims; bearer-wins-when-both
- [ ] Cross-cutting decision not already settled by the parent epic —
      the epic settled the model; this ADR codifies the specifics
      (HS256 algo, key separation, claim set, TTLs)

**ADRs to write:** **Mobile Authentication Model** — drafted in step
2, accepted in step 8. Number claimed at write time.

### Tech debt

- [x] I reviewed `docs/tech-debt.md` and noted any items this spec
      touches or could resolve.

**Tech debt items addressed:** none — register is empty (TD-001 was
resolved before slice 2 began).

## 14. Risks & open questions

- **`jose` API drift.** Pinning as direct dep on `apps/web`
  insulates. If a future major bumps the API, that's a chore.
- **Dev CLI in production.** Refusal on `NODE_ENV=production`; doc
  warning in script header.
- **Signing-key rotation downtime.** Documented in ADR; ≤15 min
  access-token disruption per rotation; refresh tokens force
  re-login. Acceptable for v1.
- **Test isolation for `iat`/`exp`.** `jose.jwtVerify` accepts a
  `currentDate` option; unit tests use it to control clock without
  monkey-patching.
- **Open question:** when iOS-issued tokens arrive in slice 3, will
  the production `AUTH_JWT_SIGNING_KEY` be set in Vercel before that
  merge? Captured in slice 3's prerequisites (not slice 2's), but
  flagged here so it's not forgotten.

---

## Implementation Deviations

> **Instruction to implementing agent:** During implementation,
> capture deviations and observations in
> `docs/implementation-notes/SPEC-002-bearer-token-auth.md` (rolling
> log). At close-out, triage that log and populate this table with
> anything that changed the design intent vs. this approved spec.

| # | Deviation | Reason | Impact | Resolved? |
|---|-----------|--------|--------|-----------|
| 1 | _none yet_ | | | |

### Post-Implementation Notes

_To be filled at close-out._
