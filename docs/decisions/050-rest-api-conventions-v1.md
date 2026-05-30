# ADR 050: REST API Conventions for `/api/v1/*`

**Date:** 2026-05-20
**Status:** Superseded by [ADR 056](./056-api-response-envelope-and-openapi.md)

## Context

EPIC-001 extracts a REST API surface so the iOS app (Expo + React Native)
can call the same use cases the web app calls via Server Actions. Slice 1
of EPIC-001 builds the first endpoint (`GET /api/v1/me`) and lays down
the conventions every subsequent `/api/v1/*` endpoint inherits.

The conventions are higher-leverage than any single endpoint: changing
the error envelope or the status-mapping rule after clients exist is a
breaking change requiring `/api/v2/`. Decisions here outlast every slice
that follows.

The existing `/api/trips/[id]/chat` route uses
`{ "error": "<string>" }` with the error string doubling as both the
human message and the branch key (`outcome.error === 'Forbidden'`). That
shape is deliberately not adopted for v1: it has no machine-readable code,
no slot for structured details, and leaks domain wording as contract.
Existing chat and next-auth routes stay at their non-v1 paths; EPIC-001's
parking lot covers their eventual migration.

EPIC-001 §10 settled the framing decisions: plain Route Handlers,
versioning prefix, cookie OR bearer auth (slice 1 = cookie only),
streaming compatibility designed for from day one, no per-user rate
limits in v1, no streaming endpoint built in EPIC-001.

## Decision

Adopt the following conventions for all `/api/v1/*` endpoints. The full
machine-readable reference lives in
[`docs/api-conventions.md`](../api-conventions.md); this ADR records the
decisions that shape it.

1. **URL prefix `/api/v1/`** for the entire v1 surface.

2. **Error envelope:**
   ```json
   { "error": { "code": "snake_case", "message": "…", "details": { /* optional */ } } }
   ```
   `code` is a member of a closed TypeScript union (`ApiErrorCode`) so
   misspellings are compile errors. `message` is safe to display to end
   users. `details` is per-code free-form.

3. **Initial code vocabulary:** `validation_failed`, `bad_request`,
   `unauthenticated`, `forbidden`, `not_found`, `conflict`,
   `user_deleted`, `gone`, `rate_limited`, `internal`, `unavailable`.
   New codes are added by editing both `ApiErrorCode` and the vocabulary
   table in the conventions doc in the same commit as the endpoint that
   introduces them.

4. **Per-handler `Result<T, E>` → HTTP mapping.** Handlers explicitly map
   their use case's domain errors to API codes via a small `switch`. No
   global auto-mapping helper. Domain error strings remain internal
   contract; the API code is the public contract.

5. **`respondWithError(code, message?, details?)` helper.** The only
   sanctioned way to construct an error response in a v1 handler.

6. **Streaming endpoints use a `/stream` path suffix** rather than
   content-type negotiation. Pre-stream errors use the unary envelope
   with the matching HTTP status; in-stream errors are emitted as a
   terminal `event: error` SSE frame carrying the same envelope shape,
   after which the connection closes. The HTTP status of a streaming
   response is always 200 once headers are sent.

7. **Cookie session and bearer token are alternative authentication
   schemes** that resolve to the same `User` row. Slice 1 ships cookie
   only; slice 2 adds bearer. The endpoint contract doesn't change
   between the two — only the credential extraction does.

8. **Default `Cache-Control: no-store`** on authenticated endpoints.

9. **Path naming:** kebab-case, plural for collections, singular for
   `/me`, no trailing slash, UUIDs as `{id}` params.

10. **Explicitly deferred from v1** (revisit when a concrete need appears):
    `request_id` correlation headers, pagination convention,
    internationalisation, HATEOAS, CORS policy, per-user rate limits on
    authenticated endpoints, richer `details.field_errors` schemas.

The vocabulary tables, JSON examples, naming details, and update process
live in the conventions doc — not here — so adding a new code doesn't
require amending an Accepted ADR.

## Consequences

**What becomes easier:**

- Every `/api/v1/*` endpoint inherits a consistent error shape; clients
  write one parser, ever.
- Adding a new error code is a one-commit change (vocabulary table +
  `ApiErrorCode` union + endpoint).
- The compile-time `ApiErrorCode` union means a typo in a handler is
  caught by `pnpm type-check`, not by a runtime test.
- The per-handler mapping rule keeps the domain layer free of API
  concerns and the API layer free of god-helpers.
- The streaming-compat principles are written down before the first
  streaming endpoint exists, so the AI SDK's protocol doesn't become the
  default by drift.

**What becomes harder:**

- Boilerplate per handler for the explicit mapping switch. Acceptable;
  per-handler mapping is reviewable and prevents leaks. Revisit if we
  ever pass ~10 endpoints with significant repetition (EPIC-001 §9 kill
  criterion).
- The `docs/api-conventions.md` doc must stay in sync as new endpoints
  add codes. Mitigated by the doc-review entry in `AGENTS.md` ("if you
  add a `/api/v1/*` endpoint, audit the conventions doc").
- Streaming principles are codified without an in-tree consumer until a
  streaming endpoint ships. Revisit if the AI SDK ergonomics push back.

**Trade-offs:**

- `code` vocabulary is finite and curated rather than free-form. A
  client implementer who needs a new error category must add it
  upstream rather than emit a one-off string. This is the intended
  trade-off: predictability over expressiveness.
- The default `Cache-Control: no-store` is conservative. Public or
  cacheable endpoints (none in v1) opt in explicitly. Cheaper than the
  reverse.
- `/stream` suffix vs content-type negotiation: chose the more
  operationally legible option. Reversible — content-type negotiation
  could be added later on the same path.
- ADR + living doc split: ADR captures the immutable decision; doc
  holds the growing vocabulary. Trade-off is one more file; benefit is
  no "amend ADR every time we add a code".
