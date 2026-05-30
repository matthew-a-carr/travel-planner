# `/api/v1/*` Conventions

> Living reference for the v1 REST API. The decision behind these
> conventions lives in
> [ADR 050](./decisions/050-rest-api-conventions-v1.md); this doc holds the
> tables that will grow as new endpoints surface new error codes and shapes.
>
> When you add a new `/api/v1/*` endpoint, audit this doc and add any new
> code, status, or convention you introduce. Reviewers should be able to
> read this and predict what your endpoint will return.

---

## URL versioning

- All v1 endpoints live under `/api/v1/`.
- Breaking changes ship under `/api/v2/`.
- A change is **breaking** if it removes a field, renames a field, changes
  a field's type, narrows a value enumeration, changes an HTTP status for
  an existing case, changes the meaning of an existing `code`, or removes
  an existing `code`. Adding a field, adding a `code`, or widening a value
  enumeration is back-compat and stays under `v1`.

## Response envelope (ADR 056 / SPEC-008)

Every `/api/v1/*` response — success **and** error — is wrapped in a
standard envelope so clients dispatch uniformly. The schemas are the
single source of truth in `packages/shared/src/envelope.ts`; the published
contract is generated from them at [`docs/openapi/v1.yaml`](./openapi/v1.yaml)
(run `pnpm openapi:generate`; CI runs `pnpm openapi:check` to reject drift).

### Success envelope (2xx)

```json
{
  "data": { /* the endpoint's resource shape */ },
  "request": { "method": "GET", "path": "/api/v1/me", "path_params": {}, "query_params": {} },
  "asof": "2026-05-21T18:00:00.000Z",
  "version": "1.1.0",
  "meta": { /* optional, endpoint-specific */ }
}
```

- `data` is the endpoint's payload (e.g. `MeResponse`).
- `request` echoes the request for correlation. `path_params` / `query_params`
  are always objects (never null). Headers are **never** echoed (PII safety).
- `asof` is the server timestamp in RFC 3339 UTC with millisecond precision
  (`YYYY-MM-DDTHH:mm:ss.sssZ`).
- `version` is the envelope semver, tracking `packages/shared`'s
  `ENVELOPE_VERSION`.
- `meta` is optional and free-form per endpoint.
- Built server-side with `respondWithData(request, data, meta?)` from
  `apps/web/src/app/api/v1/_lib/respond.ts`. `204 No Content` endpoints
  (e.g. `/revoke`) carry no body and skip the envelope.

### Error envelope (non-2xx) — RFC 7807 + closed `code`

```json
{
  "error": {
    "type": "https://travel-planner.app/errors/validation_failed",
    "title": "Validation failed",
    "status": 400,
    "detail": "Human-readable string, safe to display to end users.",
    "instance": "/api/v1/me",
    "code": "validation_failed",
    "details": { /* optional, code-specific structured data */ }
  },
  "request": { "method": "GET", "path": "/api/v1/me", "path_params": {}, "query_params": {} },
  "asof": "2026-05-21T18:00:00.000Z",
  "version": "1.1.0"
}
```

- The inner `error` is [RFC 7807 Problem Details](https://www.rfc-editor.org/rfc/rfc7807)
  (`type`, `title`, `status`, `detail`, `instance`) plus our closed `code`
  enum so clients keep compile-time-exhaustive switching.
- `code` is a member of `ApiErrorCode` (zod `z.enum` + inferred TS union;
  source of truth `packages/shared/src/api-errors.ts`). The server-side
  `respondWithError` helper, `STATUS_BY_CODE`, `TYPE_URI_BY_CODE`, and
  `DEFAULT_TITLE_BY_CODE` maps live in
  `apps/web/src/app/api/v1/_lib/errors.ts`. Misspelling is a compile error.
- `type` is one stable URI per `code` (`https://travel-planner.app/errors/<code>`);
  renaming a URI is a major-version envelope change.
- `detail` is sentence-cased, generic enough not to leak server internals,
  safe for direct display.
- `details` is optional; its shape is determined by the `code` (see
  vocabulary table below).
- `request` / `asof` / `version` are the same siblings as the success
  envelope.

## Code → HTTP status vocabulary

| HTTP | `code` | Used when | `details` shape |
|------|--------|-----------|-----------------|
| 400 | `validation_failed` | Body/params failed schema validation | `{ field_errors: [{ field: string, code: string }] }` |
| 400 | `bad_request` | Other unparseable / malformed input | `undefined` |
| 401 | `unauthenticated` | No valid session or token | `undefined` |
| 403 | `forbidden` | Authenticated but lacking access to this resource | `undefined` |
| 404 | `not_found` | Resource does not exist (or caller may not see it) | `undefined` |
| 409 | `conflict` | State conflict — e.g. duplicate, version mismatch | code-specific |
| 410 | `user_deleted` | Authenticated session for an anonymised user (ADR 031) | `undefined` |
| 410 | `gone` | Other resource that previously existed | `undefined` |
| 429 | `rate_limited` | Rate limit tripped | `{ retry_after_seconds?: number }` |
| 500 | `internal` | Unexpected server error. `message` is generic; details go to Sentry only | `undefined` |
| 503 | `unavailable` | Dependency down (DB, AI gateway, upstream) | `undefined` |

When adding a new code: edit this table in the same commit as the
endpoint and update `ApiErrorCode` in `packages/shared/src/api-errors.ts`
plus its `STATUS_BY_CODE` entry in `apps/web/src/app/api/v1/_lib/errors.ts`.

## `Result<T, E>` → HTTP mapping rule

**Do not auto-map.** Each handler explicitly maps its use case's domain
errors to API error codes via a small `switch` statement. Reasons:

- Domain error strings (`Result<T, string>`) are internal; auto-mapping
  leaks them as API contract.
- The same domain error can mean different HTTP semantics in different
  contexts.
- Per-handler mapping keeps the API surface reviewable in one file.

Use `respondWithError(request, code, { detail?, details?, title? })` to build
the response (it populates `type` / `status` / `title` / the `request` echo /
`asof` / `version` from the `code` and the `Request`). Never construct an
error response by hand.

## Path naming

- Lower-case kebab-case for multi-word path segments
  (`/api/v1/trip-templates`, not `/api/v1/tripTemplates`).
- Plural for collections (`/api/v1/trips`), singular for the
  current-user shortcut (`/api/v1/me`).
- Resource IDs as path params: `/api/v1/trips/{id}` with `{id}` always a
  UUID string in v1.
- Sub-resources: nested under the parent collection
  (`/api/v1/trips/{id}/spend`).
- No trailing slash.

## HTTP methods

- `GET` — read; idempotent; never has request body.
- `POST` — create or trigger an action; never idempotent unless
  explicitly documented per endpoint.
- `PUT` — full replace; idempotent.
- `PATCH` — partial update; idempotent.
- `DELETE` — remove; idempotent.

Server-Sent Events use `GET` with the `/stream` path suffix (see below).

## Streaming endpoints

When an endpoint streams (SSE), it lives at the unary path with a
`/stream` suffix. Example: `/api/v1/trips/{id}/chat` (unary) vs
`/api/v1/trips/{id}/chat/stream` (SSE). No content-type negotiation;
URL distinguishes.

**Pre-stream errors** (auth, validation, anything before any byte of the
event-stream is sent) use the standard unary error envelope with the
matching HTTP status.

**In-stream errors** (anything after the response started 200 OK and
headers were committed) are emitted as a final SSE event of type `error`
whose `data:` payload is the standard error envelope:

```
event: error
data: {"error":{"type":"https://travel-planner.app/errors/unavailable","title":"Service unavailable","status":503,"detail":"AI gateway temporarily unavailable.","instance":"/api/v1/trips/{id}/chat/stream","code":"unavailable"},"request":{"method":"POST","path":"/api/v1/trips/{id}/chat/stream","path_params":{"id":"…"},"query_params":{}},"asof":"2026-05-21T18:00:00.000Z","version":"1.1.0"}

```

The connection then closes. Clients treat an `event: error` frame as the
terminal frame.

The HTTP status of a streaming response is always 200 OK once headers are
sent. There is no way to change status mid-stream — error frames in-band
are the only mechanism.

> No streaming endpoint has been built in v1 yet. These principles are
> codified up-front so the first streaming endpoint inherits them rather
> than reinventing.

## Authentication

`/api/v1/*` endpoints accept **two credential formats**, both of which
resolve to the same `User` row:

- **Cookie session:** the existing next-auth `authjs.session-token`
  cookie. Used by the web client and by any caller that's already
  signed in via the browser.
- **Bearer token:** `Authorization: Bearer <jwt>` header carrying an
  HS256-signed JWT minted per ADR 051 (Mobile Authentication Model).
  Used by the iOS app and any future non-browser client.

### Helper composition

`apps/web/src/app/api/v1/_lib/auth.ts` exports three helpers:

| Helper | Accepts | Use case |
|--------|---------|----------|
| `requireCookieSession()` | cookie only | Endpoints that must reject bearer (rare; none today) |
| `requireBearerSession(request)` | bearer only | Endpoints that must reject cookie (rare) |
| `requireAuth(request)` | cookie OR bearer | **Default for all authenticated v1 endpoints** |

All three return the same `AuthResult` discriminated union (`{ ok:
true, userId, email, name, isApproved } | { ok: false, response }`).
Handlers branch identically regardless of which credential the caller
used.

### When both are present

If a request bears **both** a valid cookie session and a valid bearer
token, **bearer wins** — the response reflects the user the bearer's
`sub` claim identifies, even if the cookie identifies a different
user. Rationale: bearer is the more explicit credential; iOS clients
never send cookies, so a request with both is most likely a test
fixture or a browser session on a shared machine.

### 401 disambiguation

All bearer verification failures (missing token, malformed token,
expired token, bad signature, invalid claims) collapse to **`401
unauthenticated`** regardless of cause. The underlying error is logged
server-side for debugging but never surfaced in the response. Mobile
clients respond to any 401 by attempting refresh; if refresh fails
they re-login. Distinct codes wouldn't change that behaviour and would
confirm system internals to attackers.

Endpoints describing themselves as authenticated MUST reject requests
with neither cookie nor bearer with `401 unauthenticated`.

## Caching

Default for all authenticated v1 endpoints:

```
Cache-Control: no-store
```

`respondWithError` does not set caching headers; per-endpoint success
responses set their own as needed. Public endpoints (none in v1) may
relax this.

## Deferred — not in v1

These are intentionally out-of-scope until pressure surfaces:

- `request_id` / correlation headers in every response. Add when Sentry
  correlation needs it.
- Pagination convention. Add with the first paginated endpoint.
- Internationalisation of `message`. Audience does not justify it.
- Hypermedia / HATEOAS.
- CORS policy. Add with the first cross-origin client (slice 3 mobile
  auth callback).
- Per-user rate limiting on authenticated endpoints. EPIC-001 §10 keeps
  this off in v1; auth-mobile endpoints get edge rate limits in slice 3.
- `details.field_errors` schema beyond `[{field, code}]`. Flesh out at
  slice 3 when validation gets richer.

---

## Updating this doc

This document is **load-bearing**. It is the contract reviewers and
mobile clients consult. When you add a new endpoint:

- Add any new `code` you emit to the vocabulary table above and to the
  `ApiErrorCode` union.
- Document the `details` shape if you introduce one.
- If your endpoint uses a new HTTP method semantically, add it to the
  HTTP methods section.
- If your endpoint sets unusual caching headers, document that under
  Caching.

Per `AGENTS.md` doc-review table: adding an `/api/v1/*` endpoint means
checking this file in the same commit.
