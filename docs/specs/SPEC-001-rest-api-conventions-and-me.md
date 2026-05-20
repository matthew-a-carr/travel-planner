# SPEC-001: REST API Conventions for v1 and `GET /api/v1/me`

**Date:** 2026-05-20
**Status:** Complete
**Author:** Matt Carr (with Claude Opus 4.7 via `plan-feature` + `grill-me`)
**Approved by:** Matt Carr, 2026-05-20
**Completed:** 2026-05-20
**Parent epic:** [EPIC-001 — iOS App](../epics/EPIC-001-ios-app.md) — slice 1

---

## 1. Summary

Lay down the REST API conventions that every `/api/v1/*` endpoint inherits
— versioning prefix, error envelope, error-code vocabulary, per-handler
`Result<T, E>` → HTTP mapping rule, and streaming-compatibility
principles — then ship the first endpoint that exercises them:
`GET /api/v1/me` with cookie-session authentication. The deliverable is
one ADR, one living conventions doc, two small typed helpers, one
handler, and integration tests covering all five response branches. No
bearer auth (slice 2). No streaming endpoint (deferred until first
streaming endpoint ships).

## 2. Motivation

EPIC-001 (the iOS app) needs an extracted REST surface so mobile can
consume the same use cases the web app uses via Server Actions. Slice 1
is the foundation slice: it does not move the user-visible needle on its
own, but every subsequent API slice in this epic (and in EPIC-002) depends
on the conventions this slice locks down. The cost of getting the
envelope or error contract wrong is highest now and decreases with every
endpoint shipped after slice 1.

Inherited from EPIC-001 §10 (no re-litigation):

- API transport: plain Next.js Route Handlers (no tRPC / ts-rest / GraphQL in v1).
- API versioning: URL prefix `/api/v1/`.
- Auth on Route Handlers: cookie OR bearer; **slice 1 = cookie only**.
- Streaming compatibility designed for from day one; **no streaming endpoint built in slice 1**.
- Rate limiting: N/A in slice 1 (auth-mobile endpoints rate-limited in slice 3 only).
- Refresh-token storage / server-side observability: N/A in slice 1.

## 3. Acceptance criteria

1. Given a request with a valid cookie session for an approved user, when
   `GET /api/v1/me` is called, then the response is `200 OK` with body
   `{ "id": "<uuid>", "email": "<string>", "name": "<string|null>", "isApproved": true }`.
2. Given a request with a valid cookie session for an authenticated user
   whose `users.isApproved` is `false`, when `GET /api/v1/me` is called,
   then the response is `200 OK` with the same body shape but
   `"isApproved": false`.
3. Given a request with a valid cookie session for an anonymised
   (soft-deleted) user, when `GET /api/v1/me` is called, then the
   response is `410 Gone` with body
   `{ "error": { "code": "user_deleted", "message": "<human-readable>" } }`.
4. Given a request with no session cookie (or an invalid one), when
   `GET /api/v1/me` is called, then the response is `401 Unauthorized`
   with body `{ "error": { "code": "unauthenticated", "message": "<human-readable>" } }`.
5. Given an unhandled exception inside the handler, when `GET /api/v1/me`
   is called, then the response is `500 Internal Server Error` with body
   `{ "error": { "code": "internal", "message": "<generic; no internals>" } }`
   and the underlying error is reported to Sentry (via the existing ADR
   032 instrumentation).
6. `docs/api-conventions.md` exists and documents the envelope, the
   error-code → HTTP-status vocabulary, naming conventions for paths and
   methods, and the streaming-compat principles.
7. ADR "REST API Conventions for v1" exists in `docs/decisions/` with the
   next available number, is **Accepted**, and is listed in
   `docs/decisions/README.md`.
8. Every error code emitted by the slice 1 handler is a member of a
   compile-time `ApiErrorCode` union — a misspelling is a TypeScript
   error.

## 4. Demo script

1. Open a browser, sign in to the web app as an approved user.
2. Open devtools → Application → Cookies; copy the `authjs.session-token` value.
3. In a terminal:
   ```bash
   curl -i --cookie 'authjs.session-token=<value>' http://localhost:3000/api/v1/me
   ```
4. See `HTTP/1.1 200 OK` and body `{"id":"...","email":"...","name":"...","isApproved":true}`.
5. Without the cookie:
   ```bash
   curl -i http://localhost:3000/api/v1/me
   ```
6. See `HTTP/1.1 401 Unauthorized` and body `{"error":{"code":"unauthenticated","message":"..."}}`.
7. Open `docs/api-conventions.md` and `docs/decisions/NNN-rest-api-conventions-v1.md`
   in a code reviewer's perspective. Predict the envelope for a hypothetical
   `409 conflict` response without running anything. Spec is done.

## 5. Out of scope

- **Bearer-token authentication.** Slice 2.
- **Any streaming endpoint.** Deferred to whenever the first streaming
  endpoint ships (likely a future mobile chat epic).
- **Per-user rate limiting on authenticated endpoints.** Epic §10:
  unlimited in v1; revisit later. Auth-mobile rate limits land in slice 3.
- **`request_id` / correlation headers in every response.** Defer until
  Sentry correlation needs it; no consumer asking for it.
- **i18n of error messages.** Audience of two.
- **Hypermedia / HATEOAS.** Not idiomatic here.
- **Pagination convention.** Defer to the first paginated endpoint.
- **`details.field_errors` schema beyond `[{field, code}]`.** Flesh out at
  slice 3 when validation gets real.
- **Refactoring `/api/trips/[id]/chat`** to the new envelope. It stays at
  its non-v1 path. Epic parking lot covers eventual migration.
- **Refactoring `/api/auth/[...nextauth]`.** Out of v1 entirely.
- **Playwright e2e for `/api/v1/me`.** Added in slice 2 (bearer auth gives
  a second auth path worth validating end-to-end); slice 7 brings the true
  mobile-on-API e2e.
- **CORS policy.** Not needed for cookie + same-origin slice 1. Revisit in
  slice 3 when mobile-OAuth endpoints land.

## 6. Prerequisites

- EPIC-001 status is **Approved** (it is, as of 2026-05-20).
- Repo on the current monorepo layout (ADR 046, already shipped).
- Local dev or CI has a working `auth()` from next-auth — given by
  ADR 014's local dev fallback or real Google OAuth in `.env.local`.
- No pending DB migration is required for slice 1 (no schema change).
- Testcontainers + Docker available for integration tests (existing
  convention, ADR 009).

## 7. Design

### Data & domain

No new domain types. No domain logic added in slice 1. The existing
`User` domain shape (from `apps/web/src/infrastructure/db/schema.ts`) is
the source of truth. `Result<T, E>` is unchanged.

### Behaviour

Two thin helpers + one handler. All live under
`apps/web/src/app/api/v1/`, which becomes the home of the v1 API surface.

**`apps/web/src/app/api/v1/_lib/errors.ts`:**

```ts
export type ApiErrorCode =
  | 'validation_failed'
  | 'bad_request'
  | 'unauthenticated'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'user_deleted'       // 410, gone
  | 'rate_limited'       // 429, slice 3 onward
  | 'internal'
  | 'unavailable';

export type ApiError = {
  readonly error: {
    readonly code: ApiErrorCode;
    readonly message: string;
    readonly details?: Readonly<Record<string, unknown>>;
  };
};

export function respondWithError(
  code: ApiErrorCode,
  message: string,
  details?: Readonly<Record<string, unknown>>,
): Response;
```

The helper enforces the envelope shape and the `code → status`
mapping (internal table). Misspelling a code is a compile error.

**`apps/web/src/app/api/v1/_lib/auth.ts`:**

```ts
export type CookieSessionResult =
  | { readonly ok: true; readonly userId: string; readonly isApproved: boolean }
  | { readonly ok: false; readonly response: Response };

export async function requireCookieSession(): Promise<CookieSessionResult>;
```

Wraps `auth()` + a check against the existing `users` row. Returns
either a typed success or a pre-built `Response` for 401 / 410. The
handler's branching code becomes a small `if (!result.ok) return result.response`.

**`apps/web/src/app/api/v1/me/route.ts`:**

```ts
export async function GET(): Promise<Response> {
  const session = await requireCookieSession();
  if (!session.ok) return session.response;

  // Look up display name; respondWithError on 500 wrapped via try/catch.
  // Return 200 with { id, email, name, isApproved }.
}
```

### Storage & migrations

N/A — no schema change in slice 1.

### External integrations

N/A — no external services added. Sentry instrumentation is the existing
ADR 032 setup (auto-instruments Next.js Route Handlers).

### UI / UX

N/A — no UI. Slice 1 is API-only.

## 8. Security & data considerations

- **Threats considered:**
  - Session forgery / fixation → relies on next-auth's existing cookie
    handling (signed JWT in `authjs.session-token`); unchanged by this slice.
  - Information disclosure via 401 vs 404 — `/me` is unauthenticated-401,
    not 404, because the endpoint always exists for any authenticated
    user. No enumeration risk.
  - PII in error envelopes — the `internal` 500 code uses a generic
    message; no exception text leaks to the client. Stack traces go to
    Sentry only.
  - Anonymised users (ADR 031) — explicit 410 ensures stale cookies for
    deleted accounts can't return a misleading 200 with redacted data.
- **Mitigations:**
  - `ApiError` is a closed discriminated union; no free-form error
    construction in handlers.
  - Handler wraps non-helper code in `try`/`catch` that calls
    `respondWithError('internal', ...)`.
  - Integration tests assert the 500 body shape is generic (no leak).
- **Secrets needed:** None beyond the existing `AUTH_SECRET`.

## 9. Test plan

Tests are written **before** implementation per CONSTITUTION §3.

### E2E (Playwright)

N/A — see §5 Out of scope. Slice 2 adds the first e2e for the v1 API.

### Integration (Vitest + Testcontainers)

| Test file | What it covers |
|-----------|----------------|
| `apps/web/src/app/api/v1/me/route.int-test.ts` | The five branches per §3 acceptance criteria: 200 approved, 200 unapproved with `isApproved: false`, 410 anonymised, 401 no session, 500 generic envelope on forced throw. Each asserts both status code and full body shape. |

The 500 case uses a test-time helper that injects a failing
`requireCookieSession` (via vi.mock or a swap) so the handler's
try/catch path is exercised without contorting real auth.

### Unit (Vitest)

| Test file | What it covers |
|-----------|----------------|
| `apps/web/src/app/api/v1/_lib/errors.test.ts` | Every `ApiErrorCode` maps to its documented HTTP status; envelope shape exactly matches the contract; `details` is preserved when supplied and omitted when not. |
| `apps/web/src/app/api/v1/_lib/auth.test.ts` | Pure parts of `requireCookieSession` if any extract cleanly; otherwise this is covered by the route integration test (acceptable). |

### Manual checks

Demo script §4 — manual `curl` from a logged-in browser session,
confirming the 200 and 401 bodies match the documented envelope. No
visual / a11y check (no UI).

## 10. Observability

- **Logs:** Existing Next.js access logs cover request/response. No new
  log lines added in slice 1.
- **Metrics:** No new metrics. Vercel's built-in request metrics suffice
  for the audience-of-two.
- **Sentry / error reporting:** ADR 032's existing `@sentry/nextjs`
  setup auto-instruments Route Handlers. The 500 branch's caught
  exception is captured by Sentry's automatic exception capture; no
  manual `Sentry.captureException` call needed unless the integration
  test reveals one.

## 11. Rollback / safety

Slice 1 adds a new endpoint and helpers without touching existing
behaviour. Rollback = revert the merge commit. No data migration, no
config change, no feature flag needed. The existing chat and auth
routes are unaffected.

## 12. Implementation order

Each step pairs intent with verification. Tests-first per CONSTITUTION §3.

1. [ ] **Intent:** Write `docs/api-conventions.md` (vocabulary tables,
   naming rules, streaming-compat principles) + draft the ADR "REST API
   Conventions for v1" with the next free ADR number. **Verification:**
   Self-review against acceptance criteria §3.6 and §3.7. **Commit:**
   `docs(api): adr + conventions doc for /api/v1` — ADR status `Proposed`.
2. [ ] **Intent:** Add `apps/web/src/app/api/v1/_lib/errors.ts` with
   `ApiErrorCode`, `ApiError`, `respondWithError`. Write
   `errors.test.ts` first (every code → status, envelope shape, details
   round-trip). Implement to green. **Verification:** `pnpm test:unit`
   includes the new tests and passes. **Commit:** `feat(api): error
   envelope helper for /api/v1`.
3. [ ] **Intent:** Add `apps/web/src/app/api/v1/_lib/auth.ts`
   (`requireCookieSession`). Cover the user-row lookup branches via
   integration coverage in step 4; extract any pure parts to
   `auth.test.ts`. **Verification:** Type-check + lint clean.
   **Commit:** `feat(api): cookie-session helper for /api/v1`.
4. [ ] **Intent:** Write `route.int-test.ts` covering all five
   acceptance branches. Implement `route.ts` to green. Update
   `CHANGELOG.md` (Added: REST API v1 baseline + `/me` endpoint). Bump
   the ADR status to **Accepted** and update `docs/decisions/README.md`.
   Update EPIC-001 §7 slice 1 status → **Done** and append slice ledger.
   **Verification:** `pnpm lint && pnpm db:check:migrations && pnpm
   type-check && pnpm test:unit && pnpm test:integration` all green;
   `POSTGRES_URL=postgresql://build:build@localhost:5432/build pnpm build`
   succeeds. **Commit:** `feat(api): GET /api/v1/me (cookie auth)`.

## 13. ADR triggers and tech-debt review

### ADR?

- [x] New library, external tool, or vendor — N/A
- [ ] CI pipeline or workflow structural change — N/A
- [x] **New project-wide standard** — YES, the REST API conventions
- [x] **Non-obvious architectural trade-off** — YES, per-handler mapping
      rule + streaming-compat-without-streaming-endpoint
- [x] Cross-cutting decision not already settled by the parent epic —
      the parent epic settled the principles; this ADR codifies the
      specifics (envelope JSON, code vocabulary, mapping rule, `/stream`
      suffix call)

**ADRs to write:** **REST API Conventions for v1** — drafted in step 1,
accepted in step 4. Number claimed at write time.

### Tech debt

- [x] I reviewed `docs/tech-debt.md` and noted any items this spec
      touches or could resolve.

**Tech debt items addressed by this spec:** None — register is empty.

## 14. Risks & open questions

- **Helper extraction overshoot.** `requireCookieSession()` might grow
  to cover slice 2's bearer auth opportunistically. Discipline: keep
  cookie-only; slice 2 SPEC explicitly extends or replaces.
- **Living-doc rot.** `docs/api-conventions.md` only stays trustworthy
  if every new endpoint that adds an error code updates it. Mitigation:
  add to `AGENTS.md` doc-review table in step 4.
- **Streaming principles untested.** They live in the ADR without
  exercise until a streaming endpoint ships. Acceptable — the ADR
  flags this explicitly.
- **500 coverage in integration tests.** Forcing a real 500 requires a
  test seam; if `vi.mock` of the helper proves awkward, fall back to a
  unit test on the helper that asserts the envelope shape for `internal`
  and document the gap.

---

## Implementation Deviations

> **Instruction to implementing agent:** During implementation, capture
> deviations and observations as they happen in
> `docs/implementation-notes/SPEC-001-rest-api-conventions-and-me.md`
> (rolling log). At close-out, triage that log and populate this table
> with anything that changed the design intent vs. this approved spec.
> Use the spec's Post-Implementation Notes for learnings, and
> `docs/tech-debt.md` for unresolved debt that must outlive the spec.

| # | Deviation | Reason | Impact | Resolved? |
|---|-----------|--------|--------|-----------|
| 1 | `CookieSessionResult` returns `{ userId, email, name, isApproved }` instead of the spec's `{ userId, isApproved }`. | The helper already queried `email` for the anonymisation check; the handler needed `name` for its response body. Re-querying the same row from the handler would be wasteful. | Helper's contract widened. Slice 2's bearer-auth equivalent must return the same shape so handlers don't fork. | Yes — resolved in-flight. |

### Post-Implementation Notes

**Things that worked well:**

- **The 4-commit shape held.** Each step landed cleanly, the deliverable matched what the spec described, and no commit needed rework. The TDD ordering (tests-first) caught the helper-extraction problem in step 3 immediately (unit test couldn't import the helper because it transitively pulled in `next-auth`).
- **Per-handler `respondWithError` + closed `ApiErrorCode` union does its job.** The `/me` handler's branching reads like a small switch statement; misspellings would have been compile errors. The vocabulary table in `docs/api-conventions.md` is the single source any future endpoint reviewer consults.
- **Mocking only `auth()` was the right test seam.** Everything else — DB lookups, anonymisation detection, error envelope construction — exercises real code against real Postgres via Testcontainers. No mocked repositories, no fake error envelopes. The integration test reads as production-equivalent.

**Patterns to repeat for slice 2 and beyond:**

- **Extract pure helpers to their own file when callers transitively pull in heavy deps.** `isAnonymisedEmail` started inside `auth.ts`; pulling `next-auth` for a unit test that only wanted a string-comparison function was the wrong shape. Extraction took 60 seconds and produced a cleaner reference for ADR 031's marker.
- **`requireCookieSession()` is deliberately scoped to `/api/v1/*`** — does *not* reuse `getAuthenticatedAccessContext()`, which loads organisations and collapses unapproved-vs-anonymised. Slice 2's `requireAuth()` (cookie OR bearer) should similarly stay scoped. The pull toward "one mega helper that covers every auth concern" is real and should be resisted.
- **`vi.mocked(auth)` trips on next-auth's overloaded signature.** The `MockedAuth` type-alias pattern at the top of `route.int-test.ts` is the cleanest workaround. When the second v1 route ships in slice 2, consider extracting this into a shared test helper under `_lib/`.

**What I'd do differently:**

- The SPEC's §7 `CookieSessionResult` should have included `email` and `name` from the start. I missed this during grilling because I was thinking about auth-result shape, not response-body needs. Future SPECs: pair the helper's return type with the handler's response body in the same section.
- The SPEC didn't pre-commit Cache-Control behaviour for 2xx responses. The conventions doc says no-store by default but the SPEC didn't call it out as a test. I added the test anyway; future SPECs should treat header expectations as first-class acceptance criteria.

**Surprising existing behaviour:**

- The local pnpm v11 environment is broken because `pnpm-workspace.yaml` carries stale placeholder values under `allowBuilds:`. CI runs v10 and is unaffected, but every fresh contributor on current pnpm will hit this wall on the first `pnpm install`. Logged as `TD-001` in `docs/tech-debt.md` with a concrete fix.
