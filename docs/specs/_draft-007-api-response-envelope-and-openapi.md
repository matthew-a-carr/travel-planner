# Draft Brief — Standardised API Response Envelope + OpenAPI 3.1 YAML

**Status:** Brief (pre-spec)
**Will become:** SPEC-007

## Idea (one paragraph)

Every `/api/v1/*` response should travel in a consistent envelope. Success
bodies become `{data, request, asof, version, meta?}`; error bodies become
`{error, request, asof, version}` where `error` follows RFC 7807 (Problem
Details for HTTP APIs) **plus** our existing closed `code` vocabulary. The
contract is published as an OpenAPI 3.1 **YAML** spec generated from the
zod schemas already living in `@travel-planner/shared` — so the schemas
remain the source of truth and the YAML is a derived, committed artifact.
The semver `version` field on every response matches the OpenAPI spec's
`info.version`. The first published release is `1.1.0` (minor bump from
implicit `1.0.0`); the v1 prefix is amended in-place because the iOS app
(shipped yesterday in SPEC-006) is the only consumer and a coordinated
reshape is cheaper than running two parallel prefixes for an audience of one.

## Refined scope

- **In scope:**
  - New envelope shape for every existing v1 endpoint (`/api/v1/me`,
    `/api/v1/auth/mobile/{start,exchange,refresh,callback}`).
  - Reshape `respondWithError` and introduce `respondWithData`; both take
    the `Request` to populate the echo + `asof` + `version` + `instance`.
  - RFC 7807-style error fields: `type` URI, `title`, `status`, `detail`,
    `instance` — alongside our existing `code` and `details`.
  - Request echo limited to `{method, path, path_params, query_params}` —
    NEVER body, headers, or cookies.
  - `asof`: RFC 3339 UTC with millisecond precision (one canonical format).
  - `version`: semver string, single source of truth =
    `packages/shared/package.json#version` = OpenAPI `info.version`.
  - OpenAPI generation via `@asteasolutions/zod-to-openapi`; emits
    `docs/openapi/v1.yaml` (committed); CI drift-check via
    `pnpm openapi:check`.
  - Mobile client updated in lockstep: `apps/mobile/src/api/client.ts`
    unwraps `.data`; error dispatcher continues to switch on `code`.
  - ADR 056 supersedes ADR 050; `docs/api-conventions.md` rewritten
    accordingly.
  - Streaming carve-out: SSE responses still don't wrap each event in the
    envelope (ADR 050 §6); only the terminal `event: error` frame's
    `data:` payload uses the new RFC 7807 + `code` shape.

- **Out of scope (deliberately):**
  - Pagination convention (`meta.pagination`) — first paginated endpoint
    introduces it.
  - JSON:API `links` / hypermedia.
  - i18n of `title` / `detail`.
  - Swagger UI hosting at `/api/v1/docs`.
  - Migrating non-`/api/v1/*` routes (`/api/auth/*`, `/api/trips/*`).
  - Per-user rate limiting (settled in EPIC-001 §10).
  - `Content-Type: application/problem+json` for error responses — keep
    `application/json` for transport simplicity.

- **Out of scope (deferred — capture for later):**
  - Request correlation IDs (`X-Request-Id` round-trip) — add when Sentry
    correlation surfaces a need; tech-debt entry on close-out.
  - Bumping to `/api/v2/` with parallel prefix — reserved for the next
    breaking change once external consumers exist.

## Acceptance signal

A reviewer can:

1. `curl` any v1 endpoint with valid auth and see the new success envelope
   (`data`, `request`, `asof`, `version`).
2. `curl` any v1 endpoint with bad auth and see the RFC 7807 + `code` error
   envelope.
3. Open `docs/openapi/v1.yaml` and find every endpoint documented with the
   envelope as its response component.
4. Run `pnpm openapi:check` after touching a schema and see the command
   fail until they regenerate.
5. Cold-start the iOS app, sign in, land on the signed-in screen — the
   SPEC-006 demo loop passes unchanged.

## Alternatives considered and rejected

| Option | Why rejected |
|--------|--------------|
| Bump to `/api/v2/` (run v1 + v2 in parallel) | Audience-of-one (the iOS app) makes parallel prefixes pure cost. Coordinated v1 amendment is cheaper. ADR 050 amended explicitly to allow this. |
| Hybrid `v1.1` purely additive (`{id, email, …, _meta, _request}`) | Violates the JSON:API-style `data` wrapper the user asked for; muddles success-body shape forever. |
| Keep current `{error: {code, message, details}}` shape | Loses standards alignment with RFC 7807. User explicitly asked for "problem spec". |
| Pure RFC 7807 (drop `code`) | Mobile loses compile-time exhaustive switch on `code`; loss of safety vs gain of purity not worth it. |
| Echo request body / headers in `request` | Leaks `code_verifier`, `refresh_token`, `Authorization`. Path + query are safe-by-default; body / headers are not. |
| Hand-written OpenAPI YAML | Drifts from zod schemas the moment a schema changes; the project already runs `.parse()` against shared schemas in integration tests — auto-gen extends the same invariant. |
| `next-rest-framework` (Next.js-specific generator) | Wraps Route Handlers in a factory layer; rewrites all 5 routes for an OAS side-benefit. `@asteasolutions/zod-to-openapi` keeps the handlers as plain Next.js. |
| Emit `application/problem+json` for errors | Adds content-negotiation complexity for our caller (a single iOS app + future Swift rewrite). `application/json` for everything is simpler; problem-shape semantics are in the body. |

## Open risks

| Risk | Why it matters | Mitigation |
|------|---------------|------------|
| Mobile shipped yesterday; coordinated reshape misses a call site | Broken sign-in loop | Server + mobile changes land in the same PR; mobile Jest + web integration tests are the gate; SPEC-006 demo script re-run before merge. |
| OpenAPI generator emits non-deterministic YAML → CI flaps | False CI failures | Freeze key ordering via `yaml.stringify({…}, { sortMapEntries: true })`. |
| Clock skew between server and test fixtures makes `asof` flaky | Flaky integration tests | Inject a clock in test fixtures; runtime uses `new Date().toISOString()`. |
| ADR 050 amendment sets a precedent for casual breaking v1 changes | Future drift | ADR 056 §Consequences explicitly scopes the amendment to "pre-external-consumer window"; once the partner's mobile app lands (EPIC-002), the breaking-change rule is back in force. |

## Key answers from grilling

> **Q: Should we bump to `/api/v2/`?**
> A: No — amend v1 in-place. Only 4 routes, 1 consumer, mobile updated in
> the same PR. ADR 050 amended to scope the breaking-change rule to the
> pre-external-consumer window.

> **Q: What error shape — keep `{error: {code, message, details}}`, or
> adopt RFC 7807?**
> A: RFC 7807 fields **plus** the existing `code`. Mobile keeps
> exhaustive switching on `code`; humans get the IETF-standard fields.

> **Q: What should `request` echo?**
> A: `{method, path, path_params, query_params}` only. Never body
> (`code_verifier`, `refresh_token`), never headers (`Authorization`),
> never cookies.

> **Q: How is the OpenAPI spec produced?**
> A: `@asteasolutions/zod-to-openapi`. Zod is source-of-truth; YAML is the
> committed derived artifact. CI fails if the committed YAML differs from
> the regenerated YAML.

> **Q: Spec format — YAML or JSON?**
> A: **YAML** (user directive).

> **Q: How does streaming interact?**
> A: Carve-out per ADR 050 §6. SSE responses don't wrap individual events
> in the envelope; only the terminal `event: error` frame's `data:`
> payload uses the new RFC 7807 + `code` shape. ADR 056 codifies this
> explicitly.

> **Q: `application/problem+json` for errors?**
> A: No. Keep `application/json` for everything. Caller is a single
> iOS app + the next Swift rewrite; content negotiation is overkill.
