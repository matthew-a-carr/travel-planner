# ADR 047: REST API Conventions

**Date:** 2026-05-16
**Status:** Accepted

## Context

ADR 045 committed to exposing Travel Planner's use cases over HTTP via plain
Next.js Route Handlers (Vercel's documented Data-Access-Layer pattern) so that
an iOS app — and any future non-Next.js client — can consume the same business
logic the web app already uses. Slice 1 introduces the first endpoint
(`GET /api/v1/me`); subsequent slices will add mobile OAuth endpoints, then
trip / spend / organization endpoints.

Before the second Route Handler lands the conventions need to be written down,
because each later endpoint that copies a stale pattern accumulates cleanup
cost. The conventions cover:

- URL versioning and naming
- Success and error response shapes
- HTTP status-code mapping for the codebase's `Result<T, E>` pattern
- Where helpers, types, and tests live
- How Route Handlers compose with existing Server Actions

## Decision

### URL versioning

All public Route Handlers sit under `/api/v1/`. v2 (etc.) coexist alongside v1
when a breaking change is required; v1 is not "snapshotted" until iOS reaches
the milestone slice (ADR 045 Slice 7).

Resource paths follow the standard REST shape — plural collection nouns
(`/api/v1/trips`), singular item under an ID (`/api/v1/trips/:id`), with two
sanctioned shortcuts:

- `/api/v1/me` for the current user.
- `/api/v1/auth/mobile/*` for the PKCE flow added in ADR 048 (Slice 3).

### Response shapes

**Success:** the plain JSON shape of the resource. No envelope.

```json
{ "id": "uuid", "email": "user@example.com", "isApproved": true }
```

**Error:** a single, stable envelope.

```json
{ "error": { "code": "account_pending_approval", "message": "Account is pending approval." } }
```

`code` is a stable machine identifier the iOS client switches on. `message` is
a human-readable string that may be shown to users or used for telemetry; it
is **not** a protocol field — never parse it.

### HTTP status-code mapping

| Status | Code(s) | When |
|---|---|---|
| 200 OK | — | Successful GET or mutation returning data |
| 201 Created | — | Successful POST that creates a resource |
| 204 No Content | — | Successful DELETE or no-body mutation |
| 400 Bad Request | `invalid_input` | zod schema validation failed |
| 401 Unauthorized | `unauthenticated` | No session / invalid bearer / session points to deleted user |
| 403 Forbidden | `forbidden`, `account_pending_approval` | Authed but lacks permission |
| 404 Not Found | `not_found` | Resource doesn't exist |
| 410 Gone | `gone` | Resource explicitly removed (e.g. hard-deleted trip) |
| 500 Internal Server Error | `internal_error` | Unexpected failure |

`Result<T, E>` from the domain layer is mapped to an HTTP response by the route
handler explicitly via a `switch` on `result.error`. The mapping is **not**
hidden behind a generic helper because the right HTTP status is per-endpoint
information — a `user_not_found` use-case error means 401 on `/me` (the session
is effectively invalid) but would mean 404 on `/api/v1/users/:id`. Explicit
mapping at the handler keeps the contract grep-able.

### Helpers and types

`apps/web/src/app/api/v1/_lib/api-response.ts` exports the two response
factories:

- `apiOk(value, status = 200)` — wraps `NextResponse.json` for success.
- `apiError(code, message)` — wraps `NextResponse.json` with the error
  envelope and the status code mapped from the code.

`ApiErrorCode` is a string-union TypeScript type, exported from the same file.
Adding a new code is a one-line change in the `STATUS_BY_CODE` map. The
underscore prefix on `_lib/` keeps Next.js from treating it as a route segment.

### Authentication

For v1:

- **Cookie session (next-auth)** — used by the existing web client.
- **Bearer JWT** — added in ADR 048 (Slice 2). Both schemes resolve to the
  same `User` row via the same access policy (ADR 029).

Route Handlers do not authenticate directly. They call `auth()` for cookie
sessions and (in Slice 2 onward) a small helper for bearer tokens; both return
a session user ID or null. The handler hands the ID to a use case, which is
responsible for resolving the user row and applying access checks.

### Tests

Every Route Handler ships with a co-located `route.int-test.ts` following
ADR 012, exercised in-process by constructing a `Request` (or calling the
exported `GET` / `POST` function directly) and asserting on the returned
`Response`. The integration test boots a real Postgres via Testcontainers
(ADR 009) and seeds users / orgs / trips via the existing helpers.

Authentication is mocked at module level via `vi.mock('@/infrastructure/auth')`.
The route handler is the *only* layer where this mock exists; the use case
underneath is exercised end-to-end against real Postgres in its own
`.int-test.ts`.

### Coexistence with Server Actions

Server Actions remain the write path for the web client. They are not
deprecated. Both Server Actions and Route Handlers delegate to the same use
cases via `getAppContainer()` (ADR 028). A change to a use case automatically
flows to both clients without touching either transport layer.

If a use case grows new parameters, the Server Action and the Route Handler
are updated in the same PR. Tests for the use case cover the shared behaviour;
each transport's tests cover only its own glue.

### Versioning policy

While v1 is being built (until the iOS milestone slice), breaking changes are
allowed within v1 as long as both clients (web Server Actions and the new
Route Handlers) are updated atomically. After v1 freezes, breaking changes
move to v2.

### Pagination, filtering, sorting

Deferred. The first paginated endpoint (likely `/api/v1/trips`) decides on
cursor-based pagination with `?limit=&after=` query params; this ADR will be
amended at that point. Until then, list endpoints return the full set.

### Rate limiting and idempotency

Deferred. Mobile auth endpoints in Slice 3 may motivate Vercel Firewall rate
limits; PKCE flows are naturally idempotent on the protocol level. Decisions
go in their own ADR.

## Consequences

- **Web app unchanged.** Server Actions, the existing chat streaming endpoint,
  and next-auth all continue to behave as before. No regression risk for the
  current web user base.
- **Mobile client has a stable contract.** Stable error codes + plain JSON +
  predictable status codes mean the iOS app can write a single `fetch` wrapper
  that handles all v1 endpoints uniformly.
- **Test surface is bounded.** Use-case `.int-test.ts` files (already enforced
  by ADR 028 and the application-layer rules) cover business logic; each route
  handler's `.int-test.ts` covers only its glue (~5 tests per endpoint).
- **Future RPC layers (tRPC, ts-rest) are not foreclosed.** If endpoint
  boilerplate becomes painful, a tRPC or ts-rest layer can be added that
  delegates to the same use cases. This ADR documents the REST shape; it does
  not prescribe REST forever.
- **One small piece of friction:** explicit status-code mapping at every
  handler means a tiny amount of duplication. The alternative (a generic
  helper) loses per-endpoint semantics, which is worse than the duplication.

## Alternatives considered

- **JSON:API style (`{"data": {...}, "errors": [...]}`).** Adds envelope
  ceremony without benefit for our specific clients. Rejected.
- **RFC 9457 Problem Details for errors (`{"type": "...", "title": "...", "status": ..., "detail": "..."}`).** Standardised and machine-readable but
  overspecified for a small API. Our error shape is a strict subset of what
  RFC 9457 allows. Rejected for now; can be adopted later with a one-time
  migration if needed.
- **Error mapping in a generic helper (`resultToResponse(result)`).** Removes
  duplication but couples error semantics to error names rather than to
  endpoints. The same `user_not_found` error means different HTTP statuses on
  different endpoints; encoding that in a central helper requires runtime
  state or per-endpoint overrides that defeat the purpose. Rejected.
- **tRPC / ts-rest from the start.** Already considered and rejected in
  ADR 045 for the v1 timeline. Reopened only if boilerplate exceeds value.
- **Skipping the version prefix (`/api/me` not `/api/v1/me`).** Saves three
  characters and forecloses on cleanly running v1 + v2 in parallel. Rejected.

## References

- ADR 028 — composition-root DI container (`getAppContainer()`).
- ADR 029 — closed auth with admin pre-provisioned membership (the access
  policy `/me` and every other v1 endpoint respects).
- ADR 045 — iOS app strategy (chose plain Route Handlers).
- ADR 046 — monorepo layout (`apps/web/` is where `_lib/`, route handlers,
  and use cases live).
- [Building APIs with Next.js (Vercel, Lee Robinson, Feb 2025)](https://nextjs.org/blog/building-apis-with-nextjs)
