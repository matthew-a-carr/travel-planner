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

## Error envelope

Every non-2xx response uses this exact JSON shape:

```json
{
  "error": {
    "code": "snake_case_identifier",
    "message": "Human-readable string, safe to display to end users.",
    "details": { /* optional, code-specific structured data */ }
  }
}
```

- `code` is a member of `ApiErrorCode` (TypeScript string-literal union;
  see `apps/web/src/app/api/v1/_lib/errors.ts`). Misspelling is a compile
  error.
- `message` is a sentence-cased string, no trailing period required.
  Generic enough not to leak server internals. Safe for direct display.
- `details` is optional. When present, its shape is determined by the
  `code` (see vocabulary table below). Free-form per code; document each
  shape here when you add one.

2xx responses do not use the envelope — they return the resource shape
directly.

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
endpoint and update `ApiErrorCode`.

## `Result<T, E>` → HTTP mapping rule

**Do not auto-map.** Each handler explicitly maps its use case's domain
errors to API error codes via a small `switch` statement. Reasons:

- Domain error strings (`Result<T, string>`) are internal; auto-mapping
  leaks them as API contract.
- The same domain error can mean different HTTP semantics in different
  contexts.
- Per-handler mapping keeps the API surface reviewable in one file.

Use `respondWithError(code, message?, details?)` to build the response.
Never construct an error response by hand.

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
whose `data:` payload is the standard envelope:

```
event: error
data: {"code":"unavailable","message":"AI gateway temporarily unavailable."}

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

- **Cookie session** (slice 1+): existing next-auth `authjs.session-token`
  cookie. Resolved server-side via `requireCookieSession()` (see
  `apps/web/src/app/api/v1/_lib/auth.ts`).
- **Bearer token** (slice 2+): `Authorization: Bearer <jwt>`. Handler
  middleware accepts either cookie or bearer once slice 2 ships.

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
