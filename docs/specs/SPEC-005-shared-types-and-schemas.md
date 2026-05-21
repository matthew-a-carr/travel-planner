# SPEC-005: Shared Wire Types and Schemas (`@travel-planner/shared`)

**Date:** 2026-05-20
**Status:** Complete
**Author:** Matt Carr (with Claude Opus 4.7 via `plan-feature` + `grill-me`)
**Approved by:** Matt Carr, 2026-05-20 (after `review-spec` pass + one round of patches)
**Completed:** 2026-05-20
**Parent epic:** [EPIC-001 — iOS App](../epics/EPIC-001-ios-app.md) — slice 4

---

## 1. Summary

Create a new `packages/shared/` workspace package, published in-monorepo as
`@travel-planner/shared`, that hosts the runtime zod schemas and inferred
TypeScript types for the wire shapes that cross between `apps/web/` and
`apps/mobile/`. The package surface is bounded to the existing `/api/v1/*`
public API as of slice 3 — the four `/api/v1/auth/mobile/*` endpoint
request/response shapes, the `GET /api/v1/me` response, the
`travelplanner://auth?...` callback deep-link error-reason union, and the
`/api/v1/*` error envelope. Web's mobile-auth route handlers stop declaring
their request schemas inline and import them from the shared package
instead; `ApiErrorCode` and `ApiErrorBody` physically move out of
`apps/web/src/app/api/v1/_lib/errors.ts` into the shared package, with a
one-line re-export shim left behind so server-internal code isn't churned.
Slice 6 (mobile sign-in UI) imports from `@travel-planner/shared` directly.

User-visible impact in this slice: none. This is foundation work for
slice 6 — it changes nothing a user can observe today and breaks no
existing surface.

## 2. Motivation

EPIC-001 §7 slice 4: create the shared types package that lets the web
server and the mobile client agree on the shape of every wire payload
without coupling either side to a specific RPC framework. EPIC-001 §10
(inherited, not re-litigated):

- **Shared types**: `packages/shared/` workspace package. Both clients
  import from it. Single source of truth for types between web and
  mobile without coupling to a specific RPC protocol.
- **API transport**: plain Next.js Route Handlers under `/api/v1/*`.
  No tRPC / ts-rest / GraphQL in v1.
- **Error envelope**: `{ "error": { "code": "snake_case", "message":
  "...", "details": {...} } }` codified in `docs/api-conventions.md`
  and ADR 050.
- **`Result<T, E>` → HTTP mapping**: documented in ADR 050.

Slice 4 was budgeted at 1 day and is the simplest slice on the critical
path to slice 6. Outside the auth slice's wire shapes, no other
cross-app types exist yet — the package starts small.

The grilling session resolved one substantive shape-of-the-package
question and four mechanical ones (full Q→A trail in the pre-spec draft
brief — preserved in git history under
`docs/specs/_draft-005-shared-types-and-schemas.superseded.md`). The one
substantive decision: the package contains only wire shapes, not the full
`apps/web/src/domain/**`. That diverges from the literal phrasing of
EPIC-001 §10 and is captured as an epic-level deviation in §16 of
EPIC-001 (added in the same commit).

## 3. Acceptance criteria

1. Given a clean checkout, when I run `pnpm install`, then
   `@travel-planner/shared` resolves as a workspace dependency of both
   `apps/web/` and `apps/mobile/` (visible in their respective
   `node_modules/`).
2. Given the new package, when I run `pnpm -r type-check`, then
   `packages/shared/` is type-checked alongside `apps/web/` and
   `apps/mobile/` with no errors.
3. Given the moved error envelope types, when I `git grep "type
   ApiErrorCode"` and `git grep "type ApiErrorBody"`, then the
   definitions live in `packages/shared/src/api-errors.ts` and
   `apps/web/src/app/api/v1/_lib/errors.ts` only re-exports them.
4. Given the refactored route handlers, when I `git grep -n "const Body
   = z.object" apps/web/src/app/api/v1/auth/mobile/`, then the result is
   empty — all four request schemas are imported from
   `@travel-planner/shared`.
5. Given the amended web integration tests, when I run `pnpm
   test:integration`, then every observed mobile-auth happy-path
   response body and `/me` response body passes
   `<schema>.parse(body)` against the shared package's schema, and
   every observed error response passes `apiErrorBodySchema.parse(body)`.
6. Given the new mobile smoke test, when I run `pnpm --filter
   @travel-planner/mobile test`, then `apps/mobile/__tests__/shared.test.ts`
   imports a schema from `@travel-planner/shared`, parses a fixture, and
   passes — proving Metro + jest-expo + zod cooperate on the workspace
   package.
7. Given the new architecture-test guard, when I run `pnpm test:unit`,
   then `architecture.test.ts` walks `packages/shared/src/**/*.ts` and
   fails if any file imports anything other than `'zod'` or a sibling
   file in the same package.
8. Given the updated `next.config.ts`, when I run `POSTGRES_URL=...
   pnpm build`, then the production build succeeds with
   `transpilePackages: ['@travel-planner/shared']` in effect (no
   untranspiled-TS errors).
9. Given the closed `MobileAuthCallbackError` union, when I run
   `pnpm test:unit`, then a small structural test confirms every
   `?error=<reason>` literal emitted by `callback/route.ts` is a member
   of the union, and vice versa.

## 4. Demo script

This slice has no user-visible behaviour. The "demo" is reviewer-facing:

1. Open the repo at the merged commit. Confirm `packages/shared/` exists
   with `src/index.ts`, `src/mobile-auth.ts`, `src/me.ts`,
   `src/api-errors.ts`, and a thin `package.json`.
2. Open `apps/web/src/app/api/v1/auth/mobile/exchange/route.ts`. Confirm
   the inline `const Body = z.object({...})` is gone and the handler
   imports `mobileAuthExchangeRequestSchema` from `@travel-planner/shared`.
3. Open `apps/web/src/app/api/v1/_lib/errors.ts`. Confirm `ApiErrorCode`
   and `ApiErrorBody` are imported from `@travel-planner/shared` and
   only `respondWithError` + `STATUS_BY_CODE` remain locally defined.
4. Open `apps/mobile/__tests__/shared.test.ts`. Run `pnpm --filter
   @travel-planner/mobile test`. Test passes — proves the package works
   under Metro + jest-expo.
5. Open `apps/web/src/__tests__/architecture.test.ts`. Confirm a new
   `it('packages/shared imports only zod or siblings', ...)` block
   exists.
6. Run `pnpm lint && pnpm db:check:migrations && pnpm type-check &&
   pnpm test:unit && pnpm test:integration`. All exit 0.
7. Run `POSTGRES_URL=postgresql://build:build@localhost:5432/build
   pnpm build`. Build succeeds.

## 5. Out of scope

Inherited from EPIC-001 §6 / §10:

- No tRPC / ts-rest / GraphQL — plain REST stays.
- No replacement of Server Actions on web.

Specific to this slice:

- **No re-export of `apps/web/src/domain/**`** in any form. Neither
  path-import re-exports nor a physical move of the domain layer.
  Rejected during grilling as out-of-budget and architecturally fraught.
  Logged as epic-level deviation in EPIC-001 §16 (added in the same
  commit) so future readers know the §10 line "Re-exports
  `apps/web/src/domain/**`" was deliberately narrowed.
- **No re-export or move of `Money` / `Currency` / `Result` /
  `DateRange`** value object types or factories. Mobile doesn't need
  them for slice 6 (sign-in); deferred to whichever future spec first
  ships a trips/spend mobile screen.
- **No domain entity types** (`Trip`, `User`, `SpendEntry`, etc.) and
  no repository port interfaces. Server-internal.
- **No JWT access-token claims shape** (sub/iat/exp/iss). Mobile
  treats the access token as an opaque bearer; refresh-timing logic
  uses the `access_expires_at` field from the response body.
- **No compiled `dist/`** output, no `exports` map, no build step
  inside the package. Source-only consumed via Next
  `transpilePackages` (web) and stock Metro (mobile).
- **No standalone unit tests inside `packages/shared/`.** The package
  has no behaviour of its own; verification is integration-only.
- **No new ADR.** EPIC-001 §10 already settled the package's purpose;
  this spec is the slice that implements it. The narrowing in scope
  (wire-shapes-only) is captured as an epic-level deviation, which is
  the documented mechanism per ADR 049 — it doesn't warrant a separate
  ADR.

## 6. Prerequisites

- EPIC-001 slices 1–3 Done (SPEC-001, SPEC-002, SPEC-004). ✅ All Done.
- `apps/mobile/` exists with stock Expo SDK 54 Metro config (per
  ADR 053). ✅ Done.
- No new env vars, no new third-party accounts, no new secrets.

## 7. Design

### Package layout

```
packages/shared/
├── package.json         # name @travel-planner/shared, main src/index.ts, deps: zod ^4.4.3
├── tsconfig.json        # extends a minimal base; strict, noEmit, moduleResolution: bundler
└── src/
    ├── index.ts         # barrel re-export of everything below
    ├── mobile-auth.ts   # 4 endpoint req/res pairs + MobileAuthCallbackError union
    ├── me.ts            # MeResponse + meResponseSchema
    └── api-errors.ts    # ApiErrorCode union, ApiErrorBody + apiErrorBodySchema
```

`package.json` is intentionally minimal:

```json
{
  "name": "@travel-planner/shared",
  "version": "0.1.0",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": { "type-check": "tsc --noEmit" },
  "dependencies": { "zod": "^4.4.3" },
  "devDependencies": { "typescript": "~5.9.3" }
}
```

`tsconfig.json` matches the strict-mode bundler-resolution shape used by
the web and mobile packages so types compose cleanly when consumed via
workspace symlink.

### Wire shapes

Each shape is exported as both a runtime zod schema and an inferred
TypeScript type. Naming convention: lower-camel-case `Schema` suffix for
runtime objects, PascalCase for inferred types. Example:

```ts
// packages/shared/src/mobile-auth.ts
import { z } from 'zod';

export const mobileAuthExchangeRequestSchema = z.object({
  code: z.string().min(1),
  code_verifier: z.string().min(43).max(128),
});
export type MobileAuthExchangeRequest = z.infer<typeof mobileAuthExchangeRequestSchema>;

export const mobileAuthExchangeResponseSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1),
  // ISO 8601 UTC string. Server emits via Date#toISOString(); clients
  // parse with new Date(...). Kept as string on the wire because dates
  // don't survive JSON round-tripping without an explicit revival step.
  access_expires_at: z.string().min(1),
});
export type MobileAuthExchangeResponse = z.infer<typeof mobileAuthExchangeResponseSchema>;
```

Full shape list (derived from a code walk of the four route handlers
+ `/me`):

| Endpoint / surface | Request schema | Response schema | Notes |
|---|---|---|---|
| `POST /api/v1/auth/mobile/start` | `mobileAuthStartRequestSchema` ({ code_challenge: string 43–128 chars }) | `mobileAuthStartResponseSchema` ({ authorise_url: string, state: string }) | |
| `GET /api/v1/auth/mobile/callback` | — (URL query string; not parsed by the package) | `MobileAuthCallbackError` — closed union of `?error=<reason>` literals | Asymmetric: response is always a 302 redirect to `travelplanner://auth?...`. Mobile parses the deep-link query, not a JSON body. |
| `POST /api/v1/auth/mobile/exchange` | `mobileAuthExchangeRequestSchema` ({ code, code_verifier 43–128 chars }) | `mobileAuthExchangeResponseSchema` ({ access_token, refresh_token, access_expires_at }) | |
| `POST /api/v1/auth/mobile/refresh` | `mobileAuthRefreshRequestSchema` ({ refresh_token }) | `mobileAuthRefreshResponseSchema` — same shape as exchange success | |
| `GET /api/v1/me` | — (cookie or bearer) | `meResponseSchema` ({ id, email, name, isApproved }) | |
| Cross-cutting error envelope | — | `apiErrorBodySchema` ({ error: { code: ApiErrorCode, message, details? } }) | Imported by every error path. |

`MobileAuthCallbackError` is a `z.enum([...])` over the literal `?error=<reason>` values that `callback/route.ts` actually emits. The closed set is derived from `git grep "travelplanner://auth?error="` in `callback/route.ts` at spec time and re-asserted by a small structural test (see §9).

### Web integration

1. `apps/web/next.config.ts` gains `transpilePackages:
   ['@travel-planner/shared']`. Next 16 doesn't transpile node_modules by
   default; this opt-in is required for source-only TypeScript packages.
2. `apps/web/package.json` gains `"@travel-planner/shared":
   "workspace:*"` under `dependencies`.
3. `apps/web/src/app/api/v1/auth/mobile/{start,exchange,refresh}/route.ts`:
   - Delete the local `const Body = z.object({...})` declaration.
   - Add `import { mobileAuthXxxRequestSchema as Body } from
     '@travel-planner/shared';`
   - Everything else stays — the handlers still call `Body.safeParse(...)`
     and `respondWithError('validation_failed', ...)` on failure.
4. `apps/web/src/app/api/v1/_lib/errors.ts`:
   - Delete the local `export type ApiErrorCode = ...` and `export type
     ApiErrorBody = ...`.
   - Add `export type { ApiErrorCode, ApiErrorBody } from
     '@travel-planner/shared';` (a TS `export type` re-export — type
     erasure only, no runtime import).
   - `STATUS_BY_CODE` and `respondWithError` stay locally — they're
     server-side concerns.
5. `apps/web/src/__tests__/architecture.test.ts`:
   - Add an `it('packages/shared imports only zod or siblings', ...)`
     block that walks `packages/shared/src/**/*.ts` and asserts each
     import resolves to either `'zod'` or a sibling file (regex check
     in the same style as the existing layer-boundary blocks).

### Mobile integration

1. `apps/mobile/package.json` gains `"@travel-planner/shared":
   "workspace:*"` under `dependencies`.
2. No Metro config change required — stock `expo/metro-config@54`
   auto-handles workspace symlinks per ADR 053.
3. `apps/mobile/__tests__/shared.test.ts` — new test file:
   ```ts
   import { mobileAuthExchangeResponseSchema } from '@travel-planner/shared';
   describe('@travel-planner/shared (mobile bundler smoke)', () => {
     it('parses a representative MobileAuthExchangeResponse', () => {
       const parsed = mobileAuthExchangeResponseSchema.parse({
         access_token: 'abc.def.ghi',
         refresh_token: 'opaque-token',
         access_expires_at: '2026-05-20T12:00:00.000Z',
       });
       expect(parsed.access_token).toBe('abc.def.ghi');
     });
   });
   ```
   Located under `__tests__/` per the Expo Router co-location rule
   amended in ADR 053 (test files cannot live under `app/`).

### Storage & migrations

N/A — no schema change.

### External integrations

N/A — no third-party API change.

### UI / UX

N/A — no UI change. Slice 4 is foundation-only.

## 8. Security & data considerations

Threats considered:

- **Schema drift exposing PII or auth fields**: zero new fields are
  introduced; every shape is copied verbatim from existing route
  handlers. Risk is bounded to the existing surface.
- **Client-side validation bypass**: the package's request schemas are
  imported by web route handlers (server-side enforcement is unchanged).
  Mobile may also use them for local pre-flight validation, but the
  authoritative parse still runs server-side. No security regression.
- **Trust boundary**: the package contains no secrets, no env-var
  reads, and no network code. It's pure data definitions.

Mitigations:

- Architecture-test drift guard (§9 Unit table) prevents anything other
  than `'zod'` from being imported into the package, so no transitive
  PII-exposure surface can sneak in.
- Existing web integration tests already exercise the auth endpoint
  request schemas on valid + invalid input; after the refactor, those
  tests are the request-schema integration tests for the shared
  package.

Secrets needed: none.

## 9. Test plan

Tests written **before** implementation per CONSTITUTION.md §3. The
integration-tests-over-unit-tests preference (slice 4 grilling, Q6)
shapes the plan: no standalone unit tests inside the package; the
package is verified at both integration boundaries (web + mobile)
through tests that already need to exist.

### E2E (Playwright / Maestro)

N/A — this slice has no user-observable behaviour.

### Integration (Vitest + Testcontainers)

The four mobile-auth endpoints are covered at the HTTP layer by a single
file (`route.int-test.ts` directly under `auth/mobile/`), organised
internally as `describe('POST /start')`, `describe('GET /callback')`,
`describe('POST /exchange')`, `describe('POST /refresh')`. Per-endpoint
co-located int-test files do not exist and won't be created — the work
amends what's already there.

| Test file | What it covers |
|---|---|
| `apps/web/src/app/api/v1/auth/mobile/route.int-test.ts` | Amended in-place across all four `describe` blocks: each observed happy-path response body is `.parse()`'d against the matching schema (`mobileAuthStartResponseSchema`, `mobileAuthExchangeResponseSchema`, `mobileAuthRefreshResponseSchema`); each observed error response is `.parse()`'d against `apiErrorBodySchema`; the callback's `Location` header query string is parsed and any `error` parameter is asserted to be a member of `MobileAuthCallbackError.options`. |
| `apps/web/src/app/api/v1/me/route.int-test.ts` | Amended: response body `.parse()`'d against `meResponseSchema`. |

### Unit (Vitest / Jest)

| Test file | What it covers |
|---|---|
| `apps/web/src/__tests__/architecture.test.ts` | New `it` block: walks `packages/shared/src/**/*.ts` (path resolved as `path.resolve('../../packages/shared/src')` — cwd-based, matching the existing test's `path.resolve('src/domain')` convention; vitest runs with cwd = `apps/web/`, so `../../` goes to the repo root, then into the package) and asserts every `import … from '…'` resolves to `'zod'` or to a sibling path within the package. |
| `apps/web/src/__tests__/architecture.test.ts` | New `it` block: greps `apps/web/src/app/api/v1/auth/mobile/callback/route.ts` for `travelplanner://auth?error=` literals and asserts the closed set matches `MobileAuthCallbackError.options` (zod `z.enum([...])` exposes its values as a readonly tuple via `.options`). Catches new error reasons that weren't added to the union. |
| `apps/web/src/__tests__/architecture.test.ts` | New `it` block: greps `apps/web/src/app/api/v1/_lib/errors.ts` and asserts `ApiErrorCode` / `ApiErrorBody` are only re-exported (matches `export type \{[^}]*ApiErrorCode[^}]*\} from '@travel-planner/shared'`), not redeclared. This is the structural verification for acceptance criteria #3 — moved here from §12 step output so the test plan covers it. |
| `apps/web/src/__tests__/architecture.test.ts` | New `it` block: greps `apps/web/src/app/api/v1/auth/mobile/{start,exchange,refresh}/route.ts` and asserts no `const Body = z.object` remains — the request schemas must be imported from `@travel-planner/shared`. Structural verification for acceptance criteria #4. |
| `apps/mobile/__tests__/shared.test.ts` | New: `import { mobileAuthExchangeResponseSchema }` from the package, parse a representative fixture, assert the parse succeeds. Smoke test for Metro + jest-expo + zod compat. |

### Manual checks

- Open Expo Go on the author's iPhone, scan the SDK 54 manifest, and
  confirm the app still launches with no Metro resolution errors after
  the `@travel-planner/shared` dependency is added to mobile. (Cheap
  sanity check that the workspace symlink resolves under real device
  bundling, not just in jest.)

## 10. Observability

N/A — no new runtime behaviour. The package is data definitions only.
No logs, metrics, or Sentry events are introduced by this slice.

## 11. Rollback / safety

Low risk:

- No data migration, so no migration to undo.
- No new env vars, so no env state to revert.
- The route-handler refactor is mechanical (inline schema → imported
  schema). Revert is `git revert`.
- The `ApiErrorCode` / `ApiErrorBody` move is type-erasure only at the
  consumer sites (one-line re-export); revert is `git revert`.
- The mobile smoke test is additive; no behaviour relies on it.

If the slice ships and breaks Sentry instrumentation or Next build
(unlikely; both `transpilePackages` and Sentry are mature), `git revert`
the merge commit and the previous-known-good state is restored.

## 12. Implementation order

Each step pairs intent with verification and is small enough to commit
on its own. Tests-first per CONSTITUTION.md §3.

1. [ ] **Intent:** Create the `packages/shared/` skeleton — directory,
   `package.json`, `tsconfig.json`, empty `src/index.ts`. Add the
   `workspace:*` reference to both `apps/web/package.json` and
   `apps/mobile/package.json`. Run `pnpm install`. **Verification:**
   `node_modules/@travel-planner/shared/` exists in both app
   `node_modules/` trees; `pnpm -r type-check` exits 0.
2. [ ] **Intent:** Write the architecture-test drift guard for
   `packages/shared/src/**/*.ts` — assert imports come only from
   `'zod'` or sibling files. Use cwd-based path resolution
   (`path.resolve('../../packages/shared/src')`) to match the existing
   `path.resolve('src/domain')` convention in `architecture.test.ts`;
   vitest's cwd is `apps/web/`, so `../../` reaches the repo root.
   Initially the package has no source files beyond `index.ts`, so
   this is a no-op pass. **Verification:** `pnpm test:unit` exits 0;
   the new test is visible in the runner output.
3. [ ] **Intent:** Author the `MobileAuthCallbackError` closed union
   (as a `z.enum([...])`, so `.options` exposes the values at runtime)
   in `packages/shared/src/mobile-auth.ts`, and its companion
   structural test in `architecture.test.ts`. The structural test does
   three things: (a) greps `callback/route.ts` for
   `travelplanner://auth?error=<literal>` matches and asserts the
   captured set equals `MobileAuthCallbackError.options`; (b) asserts
   that `callback/route.ts` contains zero matches for
   `travelplanner://auth?error=${` (no template-literal-built reasons
   — keeps the literals-only convention that the grep depends on);
   (c) asserts every member of `MobileAuthCallbackError.options` is
   actually emitted somewhere in `callback/route.ts` (no dead union
   members). **Verification:** `pnpm test:unit` exits 0; introducing
   a missing literal, a template-literal reason, or an unused union
   member makes a clearly-named test fail.
4. [ ] **Intent:** Move `ApiErrorCode` + `ApiErrorBody` (and write
   `apiErrorBodySchema`) into `packages/shared/src/api-errors.ts`.
   Replace the local declarations in `apps/web/src/app/api/v1/_lib/errors.ts`
   with `export type { ... } from '@travel-planner/shared';`.
   **Verification:** `pnpm type-check` exits 0; `pnpm test:unit` and
   `pnpm test:integration` exit 0.
5. [ ] **Intent:** Author the start / exchange / refresh request +
   response zod schemas in `packages/shared/src/mobile-auth.ts`.
   Refactor the three route handlers to `import … as Body from
   '@travel-planner/shared'`. **Verification:** `pnpm test:integration`
   exits 0 (the existing SPEC-004 integration tests cover valid +
   invalid request inputs and now act as the package's request-schema
   integration tests); `pnpm test:unit` exits 0.
6. [ ] **Intent:** Author `meResponseSchema` in
   `packages/shared/src/me.ts`. Amend the two endpoint-level
   `.int-test.ts` files — `apps/web/src/app/api/v1/auth/mobile/route.int-test.ts`
   (single file, covers all four mobile-auth endpoints across four
   `describe` blocks) and `apps/web/src/app/api/v1/me/route.int-test.ts`
   — to `.parse()` observed response bodies against their shared
   schemas, and `.parse()` error responses against `apiErrorBodySchema`.
   For the callback `describe`, parse the `Location` header's query
   string and assert any `error` parameter is a member of
   `MobileAuthCallbackError.options`. **Verification:**
   `pnpm test:integration` exits 0; turning off any of the
   `.parse(...)` calls makes a clearly-named test fail.
7. [ ] **Intent:** Add `transpilePackages: ['@travel-planner/shared']`
   to `apps/web/next.config.ts`. **Verification:** `POSTGRES_URL=…
   pnpm build` exits 0.
8. [ ] **Intent:** Author `apps/mobile/__tests__/shared.test.ts` (Jest
   import-and-parse smoke test). **Verification:** `pnpm --filter
   @travel-planner/mobile test` exits 0.
9. [ ] **Intent:** Update the EPIC-001 §7 slice 4 row ("Becomes SPEC" →
   `SPEC-005 (Complete)`, status → **Done**), append the close-out row
   to the slice ledger, and (if not already added during planning) the
   epic-level deviation row to §16 capturing the wire-shapes-only
   narrowing. Update `docs/specs/README.md` index. Update the
   `AGENTS.md` doc-review table row for "A new `/api/v1/*` endpoint
   or error code" to point at **both** `packages/shared/src/api-errors.ts`
   (source of truth for `ApiErrorCode` / `ApiErrorBody`) **and**
   `apps/web/src/app/api/v1/_lib/errors.ts` (load-bearing re-export
   shim plus the runtime `respondWithError` / `STATUS_BY_CODE` map).
   **Verification:** docs-only; reads cleanly; `pnpm lint` exits 0.
10. [ ] **Intent:** Final full verification. **Verification:**
    `pnpm lint && pnpm db:check:migrations && pnpm type-check &&
    pnpm test:unit && pnpm test:integration` all exit 0 from the
    repo root; manual Expo Go smoke check on the author's iPhone
    (per §9 Manual checks) passes.

## 13. ADR triggers and tech-debt review

### ADR?

- [ ] New library, external tool, or vendor — no (zod already a web dep).
- [ ] CI pipeline or workflow structural change — no.
- [ ] New project-wide standard — no (workspace package convention
      already established by EPIC-001 §10 / ADR 046).
- [ ] Non-obvious architectural trade-off — the wire-shapes-only
      narrowing of EPIC-001 §10 is non-obvious, but it's captured as
      an epic-level deviation row in §16 of EPIC-001 per ADR 049's
      mechanism. A standalone ADR would duplicate that.
- [ ] Cross-cutting decision not already settled by the parent epic —
      no.

**ADRs to write:** none required.

### Tech debt

- [x] I reviewed `docs/tech-debt.md` (TD-002, TD-003, TD-004, TD-005).
  None block slice 4. TD-004 (mobile auth reshape for EPIC-002) will
  reshape the package's auth surface in the future — flagged but not
  addressed here.

**Tech debt items addressed by this spec:** none.

## 14. Risks & open questions

- **Zod 4 cross-bundler compat on Expo SDK 54 / jest-expo 54.** Zod 4 is
  ESM-first. The mobile smoke test (step 8) is the canary. If zod 4
  doesn't transform cleanly under jest-expo 54, fall back to pinning
  zod to a last-known-good 3.x range in the package and log as
  tech debt. Severity: low — the failure mode is loud (test fails),
  not subtle.
- **`transpilePackages` + Sentry interaction.** Next 16 + Sentry's
  instrumentation wraps imports; in theory `transpilePackages` could
  trip a Sentry-specific code path. Acceptance criterion #8 surfaces
  this before merge.
- **Closed `MobileAuthCallbackError` union completeness.** A literal in
  `callback/route.ts` that's missed by the union would break the
  exhaustive switch in slice 6. The grep-as-test in step 3 mitigates,
  but human review on the spec's enum membership is also requested.
- **Grep-as-test fragility for `?error=<reason>` literals.** The §9
  Unit test that asserts every `travelplanner://auth?error=<reason>`
  literal in `callback/route.ts` is a member of
  `MobileAuthCallbackError.options` makes a structural assumption: the
  reasons are written as **inline string literals**, not built via
  template interpolation. If a future contributor refactors to
  `Response.redirect(\`travelplanner://auth?error=${reason}\`, 302)`,
  the test silently passes while the union can drift from reality.
  Mitigation: the same test will also fail if any `travelplanner://auth?error=${`
  template-literal prefix appears in `callback/route.ts`, forcing the
  literals-only convention. Step 3 of §12 implements both halves.
- **Architecture-test placement.** The drift guard sits in
  `apps/web/src/__tests__/architecture.test.ts` — a web-side test
  governing a sibling package. If `apps/web/` were ever extracted
  (not foreseen), the test would move with it. Acceptable trade-off
  for slice 4.

---

## Implementation Deviations

| # | Deviation | Reason | Impact | Resolved? |
|---|-----------|--------|--------|-----------|
| 1 | **`MobileAuthCallbackError` enforcement design switched from runtime grep-as-test to type-only enforcement (option B).** §9 Unit table originally specified two architecture-test blocks: a bidirectional set-equality check between `callback/route.ts`'s inline `?error=<literal>` strings and `MobileAuthCallbackError.options`, plus a "no `${`-prefixed template literals" guard. Neither shipped. Instead: `MobileAuthCallbackError` is a `z.enum` in `@travel-planner/shared/mobile-auth.ts`; `handle-mobile-callback.ts`'s `deny()` parameter type and `callback/route.ts`'s `buildErrorRedirect()` parameter type are both narrowed to the union, so any drift is a `pnpm type-check` failure. | Code walk during step 3 found that 3 of 5 `?error=<reason>` values live in `handle-mobile-callback.ts` via a template-literal `deny()` helper, not in `callback/route.ts`. The spec's grep design was built on a falsified assumption about which file emits all reasons. Two paths to fix: rewrite the `deny()` template-literal pattern + the grep test to span both files (option A/C), or replace the grep test with the TypeScript union check that subsumes it (option B). | None on AC#9 — it's still observable, just via `pnpm type-check` instead of `pnpm test:unit`. Spec §3 AC#9 wording ("when I run `pnpm test:unit`, then a small structural test confirms…") is mildly stale — the check now lives in the type-checker. SPEC-005 §9 + §12 step 3 should be read with this deviation in mind. | Yes — landed in commit dbe9646. |
| 2 | **`ApiErrorBody`'s `readonly` field modifiers were dropped during the move to `@travel-planner/shared`.** Previously: `readonly error`, `readonly code`, `Readonly<Record<string, unknown>>` on `details`. Now: a `z.infer<typeof apiErrorBodySchema>` with no `readonly` modifiers. | `ApiErrorBody` is built from a zod schema in the shared package (so mobile can `.parse()` the envelope at runtime). zod's `z.infer` produces non-readonly fields by default. Preserving `readonly` would have required a manual `Readonly<>` wrapper around the inferred type — splitting the source of truth between the schema and the wrapper, defeating the package's whole purpose. | Effectively none. `ApiErrorBody` is only used as the type of a local `body` variable inside `respondWithError` (verified by `grep -rn ApiErrorBody apps/web/src` returning two hits, both in `_lib/errors.ts`). The `readonly` modifiers were defence-in-depth type hints with no runtime effect; no consumer relies on them. | Yes — landed in commit 373b6e9. |

### Post-Implementation Notes

**Type-check as a load-bearing CI gate.** Deviation #1 is interesting in
retrospect. The spec defaulted to a runtime grep-as-test for the
callback-error closed union because that's what the rest of
`architecture.test.ts` does. Once the code walk revealed the
union members are spread across two files (one with inline literals,
one with a template-literal helper), the runtime test became
fragile and `pnpm type-check` became the natural enforcement
boundary: the union exists *to be a type*, and the type system
already does exhaustive-literal checking. The lesson for future
shared-package work: if a runtime structural test exists to prove
"this set is closed", reach for the TypeScript union before reaching
for grep. The union is the test.

**Lint coverage when adding a new workspace package.** Adding
`packages/shared/` exposed a small gap: `biome.json`'s `files.includes`
didn't automatically cover the new directory. `pnpm lint` happily
reported "Checked 274 files" but `packages/shared/src/index.ts` wasn't
among them. Easy fix (append `"packages/shared/src/**"`), but worth
documenting because the same trap waits for the next workspace
package added to `packages/`. Note added to step 1's commit. Could
become a workspace-template line item eventually, but one package
isn't enough to justify the abstraction.

**zod 4 on jest-expo 54 was a non-event.** §14 risk #1 worried about
zod 4's ESM-first packaging causing transform issues under jest-expo.
The mobile smoke test (step 8) imported three schemas and exercised
`.parse()` + `.options` access — all green on the first run, no Metro
configuration changes required, no jest-expo `transformIgnorePatterns`
adjustments. The risk was reasonable to flag but the actual zero-touch
outcome confirms ADR 053's stripped-Metro-config decision is robust.

**Next 16 + `transpilePackages` + Sentry: also a non-event.** §14
risk #2 worried about Sentry's instrumentation wrapping interacting
oddly with `transpilePackages`. Production build completed in 3.9s
with 4 mobile-auth routes + `/me` all compiling clean. No special
config changes needed beyond the single-line `transpilePackages` add.

**Shape of the package after slice 4.** Three source files:
`api-errors.ts` (envelope), `me.ts` (`/me` response), `mobile-auth.ts`
(8 wire shapes — request/response for 4 endpoints + callback error
union). All exported via a flat `index.ts` barrel. Total surface:
~140 lines of TypeScript, with `zod` as the only external dependency.
Slice 6 should be able to consume it without further package-shape
work. If trips/spend mobile screens land in a future epic, the
foundation is laid for adding `Money` / `Currency` / domain DTOs
under whichever subdirectory makes sense at that point — but
deliberately deferred until there's a real consumer.

**File count: one fewer file than originally planned.** The spec's
§7 hinted at the package potentially containing a `callback.ts`
sub-module for the deep-link error union. In practice the union sits
naturally alongside the four mobile-auth request/response pairs in
`mobile-auth.ts` — no need to split. Resulting layout matches the
spec's §7 table ("`mobile-auth.ts` — 4 endpoint req/res pairs +
MobileAuthCallbackError union") exactly.

**Final commit count: 10 (matches the §12 step count exactly).** The
SPEC-004 cadence of "one commit per spec step + one commit for
planning artefacts" held. Sequence: docs(spec-005) plan, feat step 1,
test step 2, feat step 3, feat step 4, feat step 5, feat step 6,
chore step 7, test step 8, docs step 9, chore step 10 prep
(format-fix). Step 10 itself (this close-out) is the eleventh.
