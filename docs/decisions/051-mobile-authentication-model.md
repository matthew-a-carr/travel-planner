# ADR 051: Mobile Authentication Model

**Date:** 2026-05-20
**Status:** Proposed

## Context

EPIC-001 extracts a REST API surface (`/api/v1/*`) so an iOS app (Expo
+ React Native) can call the same use cases the web app calls via
Server Actions. SPEC-001 / ADR 050 shipped the first endpoint with
cookie-session authentication. The iOS app cannot use cookie sessions —
they're origin-bound and not natively supportable in a React Native
shell that talks to a different host. The mobile client needs a token
model.

The model has to satisfy several constraints:

- **Same access policy as web.** A mobile-signed-in user is exactly
  the same `User` row as a web-signed-in user. ADR 029's
  pre-provisioning + approval gate applies unchanged.
- **No new identity provider.** We continue to use Google OAuth as the
  only sign-in source. PKCE is the standard for native clients.
- **Short-lived access tokens.** A stolen token's blast radius must
  be bounded by minutes, not days.
- **Refresh without forcing repeated Google round-trips.** The user
  signed in via Google once; subsequent app-opens shouldn't bounce
  through the browser.
- **Survive token theft.** Detect when a stolen refresh token is
  reused alongside the legitimate one, and revoke the entire family.
- **Simple operationally.** Audience-of-two app; we cannot justify
  KMS or HSM. Env-var secrets are appropriate.
- **Reversible.** If a later requirement (e.g. edge verification at a
  CDN, third-party API consumers) needs asymmetric verification, we
  shouldn't be painted into a corner.

This ADR records the full model. SPEC-002 (slice 2) implements the
verification half. SPEC-NNN (slice 3) implements the PKCE issuance and
refresh-token lifecycle.

## Decision

Adopt the following mobile-authentication model for all `/api/v1/*`
endpoints.

### 1. Access tokens — HS256-signed JWTs

- **Algorithm:** HS256 via the `jose` library (already a transitive
  dep through next-auth; pinned as a direct dep on `apps/web` in
  SPEC-002 step 1).
- **Signing key:** dedicated `AUTH_JWT_SIGNING_KEY` env var,
  **separate from `AUTH_SECRET`**. Cookie sessions (signed by
  `AUTH_SECRET`) and bearer tokens (signed by `AUTH_JWT_SIGNING_KEY`)
  are cryptographically independent. Either can rotate without
  invalidating the other.
- **TTL:** 15 minutes.
- **Claims:** `{ sub: <userId>, iat, exp, iss: 'travel-planner-api' }`.
  No `aud` (we have one consumer), no `jti` (no revocation list in
  v1; access TTL is the revocation mechanism), **no
  identity-snapshot claims**. `isApproved`, `email`, `name`, etc. are
  fetched fresh from the DB on every request to avoid stale-state
  footguns (e.g. an admin un-approves a user whose 15-min-old token
  still says `isApproved: true`).
- **Wire format:** `Authorization: Bearer <jwt>`.

### 2. Refresh tokens — opaque, rotating, server-stored

- **Format:** 32 cryptographically-random bytes, base64url-encoded.
  Opaque to clients. Stored server-side as a SHA-256 hash; the
  cleartext is given to the client once at issuance and never logged.
- **TTL:** 30 days (sliding — rotation extends).
- **Storage:** new `refresh_tokens` table designed below (migration
  + use lands in slice 3, not slice 2). Columns:
  - `id` UUID PK
  - `user_id` text FK → `users.id`
  - `token_hash` text (sha256 of cleartext, indexed unique)
  - `issued_at` timestamp
  - `expires_at` timestamp
  - `replaced_by_id` UUID FK → `refresh_tokens.id` nullable (for
    rotation chain)
  - `revoked_at` timestamp nullable (for chain revocation on reuse)
- **Rotation:** every refresh issues a new pair (access + refresh)
  and sets the old refresh's `replaced_by_id` to the new one's id.
  Old refresh becomes single-use.
- **Reuse detection:** if a request presents a refresh token that is
  already marked `replaced_by` (i.e. already used to rotate), the
  presenter is either the legitimate client doing the request twice
  due to a network retry, **or** an attacker replaying a stolen
  token. We can't distinguish; the safe response is to **revoke the
  entire chain** — walk `replaced_by_id` forward and set `revoked_at`
  on every link, including the still-current refresh. The legitimate
  client is forced to re-login through Google PKCE. The attacker's
  copy is now useless.

### 3. PKCE issuance flow (slice 3)

- Mobile client generates `code_verifier` + `code_challenge` (S256).
- `POST /api/v1/auth/mobile/start` with `code_challenge` → returns
  Google authorisation URL with `state`.
- User completes Google sign-in in the system browser.
- Google redirects to `GET /api/v1/auth/mobile/callback?code=...&state=...`.
  Server exchanges Google code for profile, runs ADR 029 access
  check, mints a **one-time exchange code** keyed to `code_challenge`,
  redirects to `travelplanner://auth?code=<one-time>`.
- Mobile app deep-links the one-time code into `POST
  /api/v1/auth/mobile/exchange` with `code_verifier`. Server verifies
  the verifier matches the stored challenge, marks the one-time code
  used, issues access + refresh.
- `POST /api/v1/auth/mobile/refresh` exchanges a refresh for a new
  pair (rotation).

The above is design-only for ADR purposes. Slice 3's SPEC details
schema, validation, and integration tests.

### 4. Storage on the iOS client

- Access + refresh tokens stored via `expo-secure-store`, which maps
  to iOS Keychain. Tokens are not persisted in `AsyncStorage`,
  `localStorage`, or any other plaintext store.

### 5. Verification (slice 2)

- `/api/v1/*` route handlers accept either an
  `Authorization: Bearer <jwt>` header or the existing next-auth
  cookie session.
- **Bearer wins** when both are present (the more explicit credential
  is authoritative).
- All bearer verification failures collapse to **`401
  unauthenticated`** regardless of underlying cause (missing,
  malformed, expired, bad-sig, claims-invalid). The underlying jose
  error is logged server-side for debugging, never surfaced in the
  response.

### 6. Key rotation procedure

- Rotate `AUTH_JWT_SIGNING_KEY` in the secret store (Vercel env vars
  in production). All in-flight access tokens fail validation within
  ≤15 minutes. All refresh tokens issued under the old signing key
  fail verification too, forcing users to re-login through Google
  PKCE.
- Acceptable for v1 (audience of two).
- A future ADR may add `kid` header support and dual-signing-key
  acceptance during a rollover window, enabling zero-downtime
  rotation. The minimal-claim shape chosen here is forward-compatible
  with `kid`.

### 7. Future asymmetric signing

- HS256 is reversible to RS256 without a breaking change: add `kid`
  header support, accept both algorithms during a rollover, then
  remove HS256. No client-visible change.
- We don't do this now because no consumer needs public-key
  verification.

## Consequences

**What becomes easier:**

- Mobile clients have a clean, standard token model with no
  framework lock-in (plain `Authorization: Bearer` over HTTP, JSON
  bodies, JWT for access).
- Cookie sessions on web and bearer tokens on mobile share an
  authorisation layer (`requireAuth`) and resolve to the same `User`
  row. ADR 029's access policy isn't forked.
- Stale-claim bugs are impossible by construction — no claims to be
  stale. The DB is queried every request; the per-request cost is
  negligible for an audience of two.
- Token theft is bounded by TTL and detected on refresh.
- The signing-key rotation procedure is documented; no operator
  surprise.
- The bearer-wins-when-both rule prevents an attacker who injected a
  bearer header from being silently outvoted by a stale cookie.

**What becomes harder:**

- Two credential paths to maintain (cookie + bearer). Mitigated by
  the shared `AuthResult` type and the `requireAuth` helper that
  hides the choice from handlers.
- Refresh rotation + reuse detection has subtle edge cases (concurrent
  refresh attempts, retry-after-network-error). Will need careful
  integration testing in slice 3.
- Key rotation requires forced re-login until `kid`-based rollover
  arrives. Acceptable for v1.
- `refresh_tokens` table grows over time. Mitigated by a periodic
  cleanup of expired/revoked rows (a future operations concern, not
  required for slice 3).

**Trade-offs:**

- **HS256 vs RS256:** chose HS256 for operational simplicity. RS256
  is reachable later via `kid` rollover; no breaking change.
- **No claims snapshot:** chose freshness over latency. Acceptable
  for an audience of two; revisit only if the per-request DB hit
  becomes measurable.
- **`jti` deferred:** no revocation list for access tokens in v1.
  The 15-minute TTL is the revocation mechanism. Refresh tokens are
  individually revocable (and chain-revocable) via the database.
- **Bearer wins:** chose explicit-credential-wins over
  web-session-is-canonical. iOS is the explicit consumer; conflicting
  cookies are most likely test fixtures or browser sessions on a
  shared machine.
- **Single `unauthenticated` code:** chose privacy over diagnostic
  detail. Distinct codes (`token_expired`, `token_invalid`) would
  reveal system internals to attackers without changing client
  behaviour (mobile retries refresh on any 401 anyway).
