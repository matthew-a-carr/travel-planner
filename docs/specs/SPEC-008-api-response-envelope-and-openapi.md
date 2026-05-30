# SPEC-008: Standardised API Response Envelope + OpenAPI 3.1 YAML

**Date:** 2026-05-21
**Status:** Approved
**Author:** Claude (Opus 4.7) under Matt Carr direction
**Approved by:** Matt Carr, 2026-05-21
**Parent epic:** —

> Standalone spec. Not a slice of EPIC-001 (whose API conventions were
> settled in ADR 050 / SPEC-001). EPIC-001's remaining slices (7
> milestone, 9 observability) are independent of this work.

---

## 1. Summary

When this ships, every `/api/v1/*` endpoint returns a consistent JSON
envelope. Successful responses wrap their resource in `data` and add a
`request` echo, an `asof` server timestamp, and a `version` matching the
published OpenAPI spec. Error responses follow **RFC 7807 (Problem
Details for HTTP APIs)** — `type`, `title`, `status`, `detail`, `instance`
— while keeping our existing closed `code` vocabulary intact so the iOS
client retains compile-time exhaustive switching. The wire contract is
published as a generated **OpenAPI 3.1 YAML** spec at
`docs/openapi/v1.yaml`, derived from the zod schemas in
`@travel-planner/shared`. CI fails if the committed YAML drifts from the
schemas.

## 2. Motivation

The current `/api/v1/*` surface (5 routes — `/me` + 4× `/auth/mobile/*`)
returns raw resource shapes for success and a minimal
`{error: {code, message, details?}}` for failure (ADR 050 §2 and
`docs/api-conventions.md:50-51`). The contract is fine for an audience of
one but lacks:

- **A request echo.** Clients can't see what the server thought it
  received (useful for debugging routing bugs, especially around path/query
  params).
- **A server timestamp.** Clients have no canonical "when was this
  computed" signal for cache invalidation, log correlation, or freshness
  UX.
- **A transport-level version.** Adding fields to a shared schema is
  back-compat by ADR 050 §URL versioning, but clients today have no way
  to know which version of the contract they're talking to.
- **A machine-readable contract.** Tooling and future clients (Swift
  rewrite, third-party integrations, the partner's mobile app once EPIC-002
  lands) currently rebuild types by reading TypeScript source.
- **Standards alignment for errors.** RFC 7807 is the IETF standard for
  HTTP problem details; aligning with it makes the API legible to any
  HTTP-aware tooling without bespoke schemas.

Why now: only 4 routes exist, only one consumer (the iOS app shipped in
SPEC-006 on 2026-05-21), and the contract is still loose enough to
harden without a v2 prefix. Coordinating a single in-place v1 amendment is
cheaper than running two parallel prefixes. ADR 056 amends ADR 050's
breaking-change rule for the pre-external-consumer window; the rule
re-tightens once EPIC-002 onboards the partner's device.

## 3. Acceptance criteria

1. **Given** a valid bearer token, **when** the client calls
   `GET /api/v1/me`, **then** the body is
   `{ data: {id, email, name, isApproved}, request: {method, path, path_params, query_params}, asof: <RFC 3339 ms-UTC>, version: <semver> }`.

2. **Given** an invalid bearer token, **when** the client calls
   `GET /api/v1/me`, **then** the response is HTTP 401 and the body is
   `{ error: { type, title, status: 401, detail, instance, code: "unauthenticated" }, request, asof, version }`.

3. **Given** any v1 endpoint that previously called
   `respondWithError(code, msg, details?)`, **when** it now calls
   `respondWithError(request, code, opts?)`, **then** every existing
   integration test passes after updating its parse target to the new
   shared schema.

4. **Given** a developer changes a schema in `packages/shared/src/`,
   **when** they run `pnpm openapi:check`, **then** the command exits
   non-zero until they regenerate `docs/openapi/v1.yaml`.

5. **Given** a CI run on a PR that modified a schema but not the YAML,
   **when** the `openapi-check` job runs, **then** it fails with a clear
   "spec drift detected — run `pnpm openapi:generate`" message.

6. **Given** the iOS app installed from the SPEC-006 build, **when** the
   user signs in via the demo loop in SPEC-006 §4, **then** the loop
   completes without regression — the mobile client unwraps `.data` and
   dispatches errors on `error.code` exactly as before.

7. **Given** the conventions doc (`docs/api-conventions.md`), **when** a
   reviewer reads the Error envelope and Success envelope sections,
   **then** the examples shown match the actual response shape from a
   live `curl` against the running dev server.

8. **Given** the conventions doc (`docs/api-conventions.md`) and ADR 056,
   **when** a future implementer adds an SSE streaming endpoint, **then**
   the doc + ADR explicitly state that the terminal `event: error` SSE
   frame's `data:` payload uses the new RFC 7807 + `code` error shape
   without the surrounding `request` / `asof` / `version` siblings.
   *(Verifiable today via the doc itself; no SSE endpoint exists in v1
   to exercise.)*

## 4. Demo script

1. On a freshly cloned repo, run `pnpm install`. Confirm the new
   `@asteasolutions/zod-to-openapi` and `yaml` deps installed.

2. Run `pnpm dev`. In another shell, mint a dev token:
   ```bash
   TOKEN=$(pnpm --filter @travel-planner/web auth:mint-token -- mattcarr@benifex.com 'Matt Carr' | tail -n1)
   ```

3. Hit `/api/v1/me`:
   ```bash
   curl -sH "Authorization: Bearer $TOKEN" http://localhost:3000/api/v1/me | jq
   ```
   Expect:
   ```json
   {
     "data": { "id": "…", "email": "mattcarr@benifex.com", "name": "Matt Carr", "isApproved": true },
     "request": { "method": "GET", "path": "/api/v1/me", "path_params": {}, "query_params": {} },
     "asof": "2026-05-21T14:32:11.123Z",
     "version": "1.1.0"
   }
   ```

4. Hit `/api/v1/me` with a bogus token:
   ```bash
   curl -sH "Authorization: Bearer bogus" http://localhost:3000/api/v1/me | jq
   ```
   Expect HTTP 401 and:
   ```json
   {
     "error": {
       "type": "https://travel-planner.app/errors/unauthenticated",
       "title": "Authentication required",
       "status": 401,
       "detail": "Sign in to continue.",
       "instance": "/api/v1/me",
       "code": "unauthenticated"
     },
     "request": { "method": "GET", "path": "/api/v1/me", "path_params": {}, "query_params": {} },
     "asof": "2026-05-21T14:32:12.456Z",
     "version": "1.1.0"
   }
   ```

5. Open `docs/openapi/v1.yaml`. Confirm:
   - `info.version: "1.1.0"`.
   - Every endpoint's `responses` section references the success/error
     envelope components.
   - Components include `ApiSuccessEnvelope_MeResponse`,
     `ApiErrorEnvelope`, `RequestEcho`, plus the underlying schemas.

6. Edit `packages/shared/src/me.ts` (add a throwaway optional field).
   Run `pnpm openapi:check`. Expect it to fail with a drift message.
   Revert. Re-run; expect pass.

7. Launch the iOS app in Expo Go. Tap **Sign in with Google**. Complete
   OAuth. Land on `/signed-in?email=mattcarr@benifex.com`. The SPEC-006
   loop passes — no regression.

## 5. Out of scope

- **Pagination convention.** `meta.pagination` is reserved; the first
  paginated endpoint introduces the shape. Carried forward from ADR 050
  §Deferred via ADR 056 §Deferred.
- **JSON:API `links` / hypermedia.** Not requested; orthogonal to the
  envelope ask.
- **i18n of `title` / `detail`.** Audience-of-two doesn't justify a
  translation pipeline.
- **Swagger UI hosting at `/api/v1/docs`.** Generator lands; serving the
  generated spec via a UI is a future SPEC.
- **`application/problem+json` content type.** Use plain
  `application/json` for everything. Documented in ADR 056 §Consequences.
- **Migrating non-`/api/v1/*` routes** (`/api/auth/*`, `/api/trips/*`).
  Out of scope per ADR 050 context; explicit in conventions doc.
- **Bumping to `/api/v2/`.** Reserved for the next breaking change once
  external consumers exist.
- **Request correlation IDs** (`X-Request-Id` header round-trip). Tech
  debt on close-out — add when Sentry correlation surfaces a need.
- **Per-user rate limiting** (EPIC-001 §10 keeps this off in v1).

## 6. Prerequisites

- **SPEC-006 (Mobile Sign-In) is Complete.** Confirmed
  (`docs/specs/README.md:38`). The mobile client at
  `apps/mobile/src/api/client.ts` is the only consumer of the existing
  envelope and must be updated in lockstep.
- **`@travel-planner/shared` is published as a workspace package**
  (SPEC-005 close-out). Confirmed. Envelope schemas land alongside the
  existing wire-shape schemas.
- **No outstanding tech debt blocks this work.** Reviewed
  `docs/tech-debt.md`; TD-003..008 are all orthogonal to API contract
  shape.
- **`pnpm` workspace + Biome lint config accept new `apps/web/scripts/`
  directory.** No config change needed; scripts directory already
  excluded from `src/`-only lint scope.

## 7. Design

### Data & domain

No domain change. The envelope is a transport-layer concern.

`packages/shared/src/envelope.ts` (new):

```ts
import { z } from 'zod';
import { apiErrorCodeSchema } from './api-errors';

export const requestEchoSchema = z.object({
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']),
  path: z.string().min(1),
  path_params: z.record(z.string(), z.string()),
  query_params: z.record(z.string(), z.union([z.string(), z.array(z.string())])),
});
export type RequestEcho = z.infer<typeof requestEchoSchema>;

// RFC 3339 UTC with millisecond precision: YYYY-MM-DDTHH:mm:ss.sssZ
const asofSchema = z.string().regex(
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
  'asof must be RFC 3339 UTC with millisecond precision',
);

// Semver, matched against packages/shared/package.json#version
const versionSchema = z.string().regex(/^\d+\.\d+\.\d+$/);

export const apiErrorSchema = z.object({
  type: z.string().url(),
  title: z.string().min(1),
  status: z.number().int().min(400).max(599),
  detail: z.string().min(1),
  instance: z.string().min(1),
  code: apiErrorCodeSchema,
  details: z.record(z.string(), z.unknown()).optional(),
});
export type ApiError = z.infer<typeof apiErrorSchema>;

export function apiSuccessSchema<T extends z.ZodTypeAny>(dataSchema: T) {
  return z.object({
    data: dataSchema,
    request: requestEchoSchema,
    asof: asofSchema,
    version: versionSchema,
    meta: z.record(z.string(), z.unknown()).optional(),
  });
}

export const apiErrorEnvelopeSchema = z.object({
  error: apiErrorSchema,
  request: requestEchoSchema,
  asof: asofSchema,
  version: versionSchema,
});
export type ApiErrorEnvelope = z.infer<typeof apiErrorEnvelopeSchema>;
```

The closed `apiErrorCodeSchema` (`packages/shared/src/api-errors.ts:14-33`)
is unchanged. Only the surrounding envelope changes.

### Behaviour

**Server side** — two helpers in `apps/web/src/app/api/v1/_lib/`:

```ts
// respond.ts (new)
export async function respondWithData<T>(
  request: Request,
  data: T,
  opts?: { status?: number; meta?: Record<string, unknown>; headers?: Headers },
): Promise<Response> { /* … */ }

// errors.ts (signature change)
export function respondWithError(
  request: Request,
  code: ApiErrorCode,
  opts?: { detail?: string; title?: string; details?: Record<string, unknown> },
): Response { /* … */ }
```

Both functions:
- Extract `method` from `request.method`.
- Extract `path` from `new URL(request.url).pathname`.
- Extract `query_params` from `new URL(request.url).searchParams` (multi-value preserved as array).
- Path params: passed explicitly by the route handler via the `opts`
  argument (Next.js doesn't expose them on `Request`). Exact signature:
  `respondWithData(request, data, { pathParams?: Record<string, string>, meta?, status?, headers? })`
  and `respondWithError(request, code, { pathParams?: Record<string, string>, detail?, title?, details? })`.
  Defaults to `{}` when the caller doesn't pass `pathParams`. Routes with
  dynamic segments (none today; `/api/v1/trips/{id}/*` in future) MUST pass
  them.
- Compute `asof` via `new Date().toISOString()` — Node guarantees ms
  precision and `Z` suffix.
- Read `version` from a single import:
  `import { ENVELOPE_VERSION } from '@travel-planner/shared/version'` —
  which itself reads from `packages/shared/package.json` at build time
  via a small generated file.
- Set `Cache-Control: no-store` by default (unchanged from ADR 050 §8).

**Per-handler change** is mechanical. Example for `/api/v1/me/route.ts`:

```diff
- return Response.json(
-   { id: session.userId, email: session.email, name: session.name, isApproved: session.isApproved },
-   { headers: { 'Cache-Control': 'no-store' } },
- );
+ return respondWithData(request, {
+   id: session.userId,
+   email: session.email,
+   name: session.name,
+   isApproved: session.isApproved,
+ });
```

And every error site goes from `respondWithError('code', 'message')` to
`respondWithError(request, 'code', { detail: 'message' })`.

**Mobile client** (`apps/mobile/src/api/client.ts`):
- On 2xx: parse against `apiSuccessSchema(meResponseSchema)` etc.;
  return `parsed.data`.
- On non-2xx: parse against `apiErrorEnvelopeSchema`; throw a
  `ApiClientError` carrying `error.code` for the dispatcher (existing
  switch logic on `code` keeps working).
- Defensive fallback: if parse fails (e.g. envelope drift), surface a
  generic `internal` code so the UI still renders something.

### Storage & migrations

N/A — no storage change.

### External integrations

N/A — no third-party API change.

### UI / UX

N/A — internal contract change only. The mobile sign-in UI from SPEC-006
is exercised but not modified except for the client-side parse layer.

## 8. Security & data considerations

- **Threats considered:**
  - PII / credential leak via `request` echo if the body or headers were
    included.
  - Sensitive data in `details` (e.g. raw refresh tokens, OAuth codes).
  - Information leak via the `type` URI (e.g. revealing internal
    structure).
- **Mitigations:**
  - Echo is constrained at the helper signature to
    `{method, path, path_params, query_params}` only. There is no code
    path that echoes body or headers.
  - `details` shapes per `code` are already documented in
    `docs/api-conventions.md`; the schema accepts only public-safe
    fields (`field_errors`, `retry_after_seconds`). The new envelope
    doesn't widen this.
  - `type` URIs are `https://travel-planner.app/errors/<code>` — the
    `code` set is already public via the conventions doc, so no new
    surface area.
- **Secrets needed:** None new.

## 9. Test plan

Tests are written **before** implementation per CONSTITUTION.md §3.

### E2E (Playwright)

| Test file | Scenario |
|-----------|----------|
| `apps/web/tests/e2e/api-v1-envelope.spec.ts` (new) | Authenticated session hits `/api/v1/me`, asserts envelope shape + `asof` format + `version` matches `package.json`. |
| `apps/web/tests/e2e/sign-in.spec.ts` (existing — verify no regression) | Cookie sign-in flow still completes; mobile-mediated bearer flow not exercised in web e2e. |

### Integration (Vitest + Testcontainers)

| Test file | What it covers |
|-----------|----------------|
| `apps/web/src/app/api/v1/me/route.int-test.ts` (existing — reshape) | Success envelope shape; 401 envelope shape; `asof` is well-formed RFC 3339 ms-UTC; `request.path_params` is `{}`; `version` equals `packages/shared` version. |
| `apps/web/src/app/api/v1/auth/mobile/start/route.int-test.ts` (existing — reshape) | Success + every error code returns the new envelope; `details.field_errors` survives on validation failure. |
| `apps/web/src/app/api/v1/auth/mobile/exchange/route.int-test.ts` (existing — reshape) | Same. Includes all 6 mobile-auth-specific codes. |
| `apps/web/src/app/api/v1/auth/mobile/refresh/route.int-test.ts` (existing — reshape) | Same. Covers `refresh_reused`, `refresh_expired`, `refresh_revoked`, `refresh_unknown`. |
| `apps/web/src/app/api/v1/auth/mobile/callback/route.int-test.ts` (existing — reshape) | Redirect path unchanged (callback emits a deep-link, not an envelope); negative-path errors that DO return an envelope use the new shape. |

### Unit (Vitest, Jest)

| Test file | What it covers |
|-----------|----------------|
| `packages/shared/src/envelope.test.ts` (new) | `apiSuccessSchema<T>(data)` parses valid + rejects malformed envelopes; `apiErrorEnvelopeSchema` parses RFC 7807 fields + rejects missing `code`; `requestEchoSchema` accepts/rejects each field; `asof` regex matches `YYYY-MM-DDTHH:mm:ss.sssZ` only. |
| `apps/web/src/app/api/v1/_lib/respond.test.ts` (new) | `respondWithData` builds the success envelope, populates echo from a `Request`, formats `asof`, sets `Cache-Control: no-store`; `respondWithError` maps `code` → status + type URI + default title; `details` and `detail` passthrough work. |
| `apps/web/src/app/api/v1/_lib/errors.test.ts` (existing — reshape) | Existing assertions updated to the new envelope; `STATUS_BY_CODE` unchanged. |
| `apps/mobile/__tests__/api/client.test.ts` (new or existing) | `.data` unwrap on success; `error.code`-based dispatch on failure; envelope-drift fallback to `internal`. |
| `apps/web/scripts/generate-openapi.test.ts` (new) | Generator emits valid OAS 3.1 YAML; key ordering is stable; component refs are wired; `info.version` matches `packages/shared/package.json` `version`; **`--check` mode exits non-zero when a schema is mutated and the YAML is not regenerated, and exits zero on the committed file**. |

### Manual checks

- Demo script §4 walked through end-to-end on a real iPhone via Expo Go.
- `pnpm openapi:check` smoke: edit a schema, expect failure; revert,
  expect pass.
- Open `docs/openapi/v1.yaml` in an OpenAPI viewer (e.g.
  `npx @redocly/cli preview-docs docs/openapi/v1.yaml`) — confirm it
  renders cleanly.

## 10. Observability

- **Logs:** No change — `respondWithData` / `respondWithError` are
  structurally observable via Vercel access logs (status + path) as
  before.
- **Metrics:** N/A.
- **Sentry / error reporting:** No change to Sentry breadcrumb shape;
  the server-side error path still calls `Sentry.captureException` where
  it did before (`/api/v1/auth/mobile/refresh/route.ts` chain-revoke
  hook is unchanged).

## 11. Rollback / safety

- **Reversibility:** Pure code change. No DB migration, no env var, no
  third-party config. Revert the PR to restore prior shape.
- **Coordinated rollback:** Mobile client change ships in the same PR;
  reverting the PR reverts both server and client atomically. The iOS
  app's existing build (SPEC-006 close-out, 2026-05-21) is unaffected
  until a new bundle is pushed via Expo Go — which only happens after
  this PR's mobile changes are merged. So there's no in-flight client
  with an old contract trying to parse a new envelope.
- **Vercel preview deploys** carry the matching server + bundle; no
  cross-version preview pairing.
- **No data risk.** Envelope is computed per-request.

## 12. Implementation order

Each step pairs **intent** with **verification** and is small enough to
commit on its own. Tests precede implementation per CONSTITUTION.md §3.

1. [ ] **Intent:** Materialise this spec + draft brief + ADR 056 stub into source so reviewers can comment in-line.
       **Verification:** `docs/specs/SPEC-008-*.md` + `docs/specs/_draft-008-*.md` + `docs/decisions/056-*.md` (Status: Draft) exist; `docs/specs/README.md` updated; `pnpm lint` green. — *Done by this commit.*

2. [ ] **STOP — Draft → Approved gate.** Human reviews SPEC-008 and ADR 056. Implementation pauses here.

3. [ ] **Intent:** Add envelope schemas to `@travel-planner/shared`; bump package version to `1.1.0`.
       **Verification:** `packages/shared/src/envelope.test.ts` covering `requestEchoSchema`, `asof` regex, `apiSuccessSchema<T>`, `apiErrorSchema`, `apiErrorEnvelopeSchema`. `pnpm --filter @travel-planner/shared test` green. `pnpm type-check` green across workspace.

4. [ ] **Intent:** Implement `respondWithData` in `apps/web/src/app/api/v1/_lib/respond.ts`. Reshape `respondWithError` in `_lib/errors.ts` to the new signature. Add `TYPE_URI_BY_CODE` + `DEFAULT_TITLE_BY_CODE` maps.
       **Verification:** New `_lib/respond.test.ts` + reshaped `_lib/errors.test.ts` green. `pnpm test:unit` green.

5. [ ] **Intent:** Reshape `/api/v1/me/route.ts` and its int-test.
       **Verification:** `apps/web/src/app/api/v1/me/route.int-test.ts` updated to parse against `apiSuccessSchema(meResponseSchema)`; `pnpm test:integration` green.

6. [ ] **Intent:** Reshape `/api/v1/auth/mobile/{start,exchange,refresh,callback}/route.ts` and their int-tests (one commit per route).
       **Verification:** Each route's int-test parses against the new envelope. Full `pnpm test:integration` green.

7. [ ] **Intent:** Update mobile client (`apps/mobile/src/api/client.ts`) to unwrap `.data` and dispatch errors on `error.code` via the new envelope. Update mocks.
       **Verification:** `pnpm --filter @travel-planner/mobile test` green. `pnpm --filter @travel-planner/mobile type-check` green.

8. [ ] **Intent:** Annotate every shared schema with `.openapi(...)` metadata. Write `apps/web/scripts/generate-openapi.ts` and add `openapi:generate` + `openapi:check` scripts (web package + root pass-through).
       **Verification:** `pnpm openapi:generate` writes `docs/openapi/v1.yaml`; `pnpm openapi:check` exits 0 on the committed file; opening the YAML in an OpenAPI viewer renders. New `apps/web/scripts/generate-openapi.test.ts` green.

9. [ ] **Intent:** Add CI gate. Append `pnpm openapi:check` to the existing `lint` job in `.github/workflows/ci.yml` (sub-second check; not worth a parallel job slot).
       **Verification:** Push a branch with a deliberate schema/YAML mismatch and observe the `lint` job fail with the drift message; revert. Add `docs/openapi/README.md` explaining the regen command.

10. [ ] **Intent:** Rewrite the affected sections of `docs/api-conventions.md` (Success envelope, Error envelope, Request echo, Versioning of the envelope). Update `CLAUDE.md` doc-review table. Update `docs/decisions/050-*.md` status to `Superseded by ADR 056`. Set ADR 056 status to `Accepted`. Update `docs/decisions/README.md`. CHANGELOG entry under `## [Unreleased]`.
       **Verification:** `pnpm lint` green. Doc-only commit; reviewable as a single read.

11. [ ] **Intent:** Add SPEC-008 Playwright e2e test.
       **Verification:** `apps/web/tests/e2e/api-v1-envelope.spec.ts` green via `pnpm test:e2e:web`.

12. [ ] **Intent:** Full verification suite (root): `pnpm lint && pnpm db:check:migrations && pnpm type-check && pnpm test:unit && pnpm test:integration && POSTGRES_URL=postgresql://build:build@localhost:5432/build pnpm build && pnpm test:e2e:web && pnpm openapi:check`. Plus mobile filter. Plus manual demo §4.
       **Verification:** All exit 0; demo §4 walks cleanly.

13. [ ] **Intent:** Triage rolling notes file (`docs/implementation-notes/SPEC-008-api-response-envelope-and-openapi.md`) → deviations table / post-impl notes / tech debt (request correlation ID, swagger UI hosting).
       **Verification:** SPEC-008 status updated to `Complete`. `docs/tech-debt.md` updated as needed.

## 13. ADR triggers and tech-debt review

### ADR?

- [x] New library, external tool, or vendor — `@asteasolutions/zod-to-openapi`, `yaml`
- [x] CI pipeline or workflow structural change — new `openapi-check` job (or extension to `lint`)
- [x] New project-wide standard — the envelope replaces the prior bare-resource success contract; RFC 7807 alignment
- [x] Non-obvious architectural trade-off — in-place v1 amendment vs `/api/v2/` prefix; supersedes ADR 050
- [ ] Cross-cutting decision not already settled by the parent epic — N/A (no parent epic)

**ADRs to write:** **ADR 056** — *REST API Response Envelope and OpenAPI Publication*. Supersedes ADR 050.

### Tech debt

- [x] I reviewed `docs/tech-debt.md` and noted any items this spec touches or could resolve.

**Tech debt items addressed by this spec:** None directly. TD-003..TD-008 are orthogonal to API contract shape. This SPEC may *add* one tech-debt entry at close-out: request correlation ID round-trip (deferred from ADR 050 §Deferred).

## 14. Risks & open questions

- **Mobile lockstep risk** (Medium / High): the iOS app's deployed bundle (Expo Go) won't be updated until this PR's mobile changes ship. Mitigation: server + mobile in the same PR; the SPEC-006 demo script is the merge gate. No mid-flight client incompatibility because Expo Go only serves bundles from the dev machine.
- **OpenAPI generator determinism** (Low / Medium): the `yaml` package will be configured with stable key ordering. CI runs the generator and diffs against the committed file.
- **ADR 050 amendment precedent** (Low / Medium): ADR 056 explicitly scopes the in-place amendment to the pre-external-consumer window. The breaking-change rule re-tightens once EPIC-002 lands a second consumer.
- **`asof` ms-precision flake** (Low / Low): tests inject a frozen clock; runtime uses `new Date().toISOString()` which is deterministic on Node.
- **No open question requiring re-grilling.** Four forks were resolved in the planning interview; all captured in the draft brief.

---

## Implementation Deviations

> Populated at close-out by the implementing agent. Rolling notes live in
> `docs/implementation-notes/SPEC-008-api-response-envelope-and-openapi.md`.

| # | Deviation | Reason | Impact | Resolved? |
|---|-----------|--------|--------|-----------|
| 1 | _to be filled_ | | | |

### Post-Implementation Notes

_To be filled at close-out._
