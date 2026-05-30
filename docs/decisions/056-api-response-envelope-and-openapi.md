# ADR 056: REST API Response Envelope and OpenAPI Publication

**Date:** 2026-05-21
**Status:** Accepted (supersedes [ADR 050](./050-rest-api-conventions-v1.md))

> **Approved:** Matt Carr, 2026-05-21, alongside SPEC-008 acceptance.

## Context

ADR 050 codified `/api/v1/*` conventions for an audience-of-one: raw
resource shapes for 2xx responses, a minimal
`{error: {code, message, details?}}` envelope for non-2xx. The closed
`ApiErrorCode` vocabulary lives in `@travel-planner/shared` (per ADR 050
and SPEC-005); the server-side `respondWithError` helper lives in
`apps/web/src/app/api/v1/_lib/errors.ts`.

This was the right starting shape for SPEC-001 through SPEC-006. With the
iOS app shipped (SPEC-006, 2026-05-21) the contract surface is now four
real endpoints and one real consumer. Three gaps have surfaced:

1. **No request echo.** Clients can't observe how the server interpreted
   path / query params — useful for debugging routing and for visibility
   into API behaviour during incident response.
2. **No server timestamp.** No canonical "when was this computed" signal
   for cache invalidation, log correlation, or freshness UX.
3. **No transport version.** Adding fields to a shared schema is back-compat
   under ADR 050's rules, but clients have no signal of which version of
   the contract they're talking to.
4. **No machine-readable spec.** The wire shape exists only as TypeScript
   in `packages/shared/src/`. Future clients (Swift, third-party,
   EPIC-002's partner-facing build) need a generated contract artifact.
5. **Error envelope is not IETF-aligned.** RFC 7807 (Problem Details for
   HTTP APIs) is the standard; current shape predates and ignores it.

The cost of fixing this in-place is bounded: 5 routes, 1 consumer, the
consumer's build pipeline is fully under our control. The cost of *not*
fixing it grows with each new endpoint and each new consumer.

ADR 050's own §URL versioning rule classifies the envelope reshape as a
*breaking change* — "renames a field, changes a field's type". By the
letter of the rule, the new envelope ships under `/api/v2/`. The
exceptional circumstance this ADR addresses is that the rule was written
to protect external consumers who don't exist yet. Once EPIC-002 onboards
the partner's device as a second consumer, the rule re-tightens; until
then, an in-place v1 amendment with a coordinated mobile bump is
materially cheaper than running two parallel prefixes.

## Decision

Adopt the following for all `/api/v1/*` endpoints. Full machine-readable
reference is being updated in `docs/api-conventions.md`; this ADR records
the load-bearing decisions.

1. **Success envelope (2xx):**
   ```jsonc
   {
     "data": <T> | <T[]>,
     "request": { "method", "path", "path_params", "query_params" },
     "asof": "<RFC 3339 UTC, ms precision>",
     "version": "<semver>",
     "meta": { /* optional, per-endpoint */ }
   }
   ```

2. **Error envelope (non-2xx) — RFC 7807 + closed `code`:**
   ```jsonc
   {
     "error": {
       "type": "<URI>",
       "title": "<short>",
       "status": <int>,
       "detail": "<long>",
       "instance": "<request path>",
       "code": "<closed enum from @travel-planner/shared>",
       "details": { /* optional, per-code */ }
     },
     "request": { /* same shape as success */ },
     "asof": "<RFC 3339 UTC, ms precision>",
     "version": "<semver>"
   }
   ```
   `code` remains the load-bearing dispatch field for clients. The RFC
   7807 fields are additive and are populated server-side from the `code`
   via lookup maps in `_lib/errors.ts`.

3. **Request echo scope:** `{method, path, path_params, query_params}`
   only. **Never** body, headers, or cookies. The helper signature
   enforces this — there is no code path that adds body or headers to
   the echo.

4. **`asof` format:** `YYYY-MM-DDTHH:mm:ss.sssZ` (RFC 3339 UTC,
   millisecond precision). One canonical format. No locale, no offset
   variants. Schema enforces it via regex.

5. **`version` field:** Semver string equal to
   `packages/shared/package.json#version`, which equals the OpenAPI
   `info.version`. Single source of truth.

6. **OpenAPI 3.1 YAML publication:** `docs/openapi/v1.yaml` is generated
   by `apps/web/scripts/generate-openapi.ts` using
   `@asteasolutions/zod-to-openapi`. The YAML is **committed** to the
   repository. CI runs `pnpm openapi:check` and fails on drift between
   the committed YAML and the schemas in `@travel-planner/shared`.

7. **Content type:** All responses use `application/json`. The
   `application/problem+json` media type defined by RFC 7807 is
   intentionally not adopted — content negotiation overhead is not
   justified for the current consumer set.

8. **Streaming carve-out** (continuing ADR 050 §6): SSE endpoints do
   NOT wrap individual events in the envelope. Pre-stream errors use
   the unary envelope; in-stream errors are emitted as a terminal
   `event: error` SSE frame whose `data:` payload uses the new RFC
   7807 + `code` error shape (without the surrounding `request` /
   `asof` / `version` siblings — those are unary-envelope concerns).

9. **In-place v1 amendment vs `/api/v2/` prefix:** v1 is amended in
   place; the iOS app is updated in the same PR. ADR 050's
   §URL versioning breaking-change rule is **scoped** by this ADR to
   the pre-external-consumer window. Once EPIC-002 onboards a second
   consumer, the rule re-tightens — further restructures ship under
   `/api/v2/`.

10. **SemVer policy** for the published spec (applied to
    `info.version` and to the runtime `version` field):
    - **Major** — remove/rename top-level envelope key, remove a
      `code`, change a `code`'s HTTP status, remove a response-schema field.
    - **Minor** — add an endpoint, add a `code`, widen an enum, add an
      optional response field or `meta` key.
    - **Patch** — description / title-only tweaks.
    First release under this ADR is `1.1.0` (minor bump from implicit
    `1.0.0`).

## Consequences

**What becomes easier:**

- Every v1 response is uniformly structured; clients write one parser.
- Request echo + `asof` give immediate visibility during incident
  response without needing extra logs.
- The OpenAPI YAML is a generated artifact — schema changes can't
  silently drift from the published contract (CI fails on drift).
- RFC 7807 alignment makes the error shape immediately legible to any
  HTTP-aware tooling that knows the standard.
- Future clients (Swift rewrite, third-party) consume one published
  YAML rather than re-deriving types from TypeScript.

**What becomes harder:**

- Every error site has slightly more ceremony: the handler must pass
  the `Request` to `respondWithError`. Acceptable — the alternative
  is a hidden context object that's harder to follow.
- The mobile client now has a defensive parse-fallback path (envelope
  drift → generic `internal`) — a tiny amount of new code that
  shouldn't ever fire if CI is green.
- The committed `docs/openapi/v1.yaml` adds a CI gate; if `yaml`
  emits non-deterministic output for any reason, the gate flaps. Mitigation:
  freeze key ordering via `sortMapEntries: true`.

**Trade-offs:**

- **In-place v1 amendment vs `/api/v2/`:** Project rules favour v2 once
  *any* consumer exists. Exception is taken because the consumer is
  under our direct control and the cost of parallel prefixes outweighs
  the discipline-preservation benefit for a window of ~weeks. The
  amendment is scoped to *this* change; the next breaking change ships
  under `/api/v2/` as the rule originally intended.
- **RFC 7807 + `code` vs pure RFC 7807:** Pure RFC 7807 dispatches on
  `type` URI, which clients would need to map back to a closed enum
  for exhaustive switching. Keeping `code` preserves compile-time
  safety the iOS client already relies on.
- **`application/json` vs `application/problem+json`:** RFC 7807
  recommends the latter for error responses. Skipping it sacrifices
  one standards-checkbox in exchange for simpler client code. Revisit
  if a third-party consumer asks for it.
- **Committed YAML vs runtime generation:** Committing the YAML makes
  it human-reviewable in PRs and consumable without a build step;
  runtime generation would require running the server to fetch the
  spec. CI drift-check restores the "schema is truth" invariant.

## References

- [SPEC-008](../specs/SPEC-008-api-response-envelope-and-openapi.md)
- [ADR 050 — REST API Conventions for `/api/v1/*`](./050-rest-api-conventions-v1.md) (superseded by this ADR on Accept)
- [RFC 7807 — Problem Details for HTTP APIs](https://www.rfc-editor.org/rfc/rfc7807)
- [RFC 3339 — Date and Time on the Internet](https://www.rfc-editor.org/rfc/rfc3339)
- [OpenAPI 3.1.0 Specification](https://spec.openapis.org/oas/v3.1.0)
- [`@asteasolutions/zod-to-openapi`](https://github.com/asteasolutions/zod-to-openapi)
- [`@travel-planner/shared`](../../packages/shared/) — wire-shape source of truth
