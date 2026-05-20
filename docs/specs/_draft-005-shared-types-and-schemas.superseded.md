# Draft Brief — Shared Wire Types and Schemas (`@travel-planner/shared`)

**Status:** Brief (pre-spec)
**Will become:** SPEC-005
**Parent epic:** [EPIC-001 — iOS App](../epics/EPIC-001-ios-app.md) — slice 4

---

## Idea (one paragraph)

Create a new `packages/shared/` workspace package, published in-monorepo as
`@travel-planner/shared`, that holds the runtime zod schemas and TypeScript
types for the wire shapes that cross the network between `apps/web/` and
`apps/mobile/`. The package's surface is bounded to the existing
`/api/v1/*` public API as of slice 3: the four mobile-auth endpoint
request/response shapes, the `GET /api/v1/me` response, the
`travelplanner://auth?...` callback deep-link error reason union, and the
`/api/v1/*` error envelope (`ApiErrorCode` union + `ApiErrorBody`). The
web app's existing mobile-auth route handlers stop declaring their request
schemas inline and import them from the shared package instead; the
`ApiErrorCode` union physically moves out of `apps/web/src/app/api/v1/_lib/errors.ts`
into the shared package; web re-exports the type so server-internal code
isn't churned beyond what the move requires.

## Refined scope

**In scope:**

- New `packages/shared/` workspace package, published as
  `@travel-planner/shared`, source-only (`"main": "./src/index.ts"`).
- Six wire shapes, each exported as **both** a runtime zod schema and a
  TypeScript type inferred via `z.infer<typeof schema>`:
  - `MobileAuthStartRequest` / `MobileAuthStartResponse`
  - `MobileAuthExchangeRequest` / `MobileAuthExchangeResponse`
  - `MobileAuthRefreshRequest` / `MobileAuthRefreshResponse`
  - `MeResponse`
  - `ApiErrorBody` (with `ApiErrorCode` union)
- One shape that has no request/response symmetry — `MobileAuthCallbackError`,
  a closed string-literal union of the `?error=<reason>` values that
  `callback/route.ts` writes into the deep link today
  (`invalid_request`, `access_denied`, `server_error`, …; the closed set is
  derived from a code walk of `callback/route.ts` at spec time).
- `zod` declared as a regular dependency of the shared package, pinned to
  match web's `^4.4.3`.
- `apps/web/next.config.ts` gains `transpilePackages: ['@travel-planner/shared']`.
- The four mobile-auth route handlers in `apps/web/` are refactored to
  import their request schemas from `@travel-planner/shared` instead of
  declaring inline `z.object({...})` constants.
- `ApiErrorCode` and `ApiErrorBody` move physically to
  `packages/shared/src/api-errors.ts`. `apps/web/src/app/api/v1/_lib/errors.ts`
  keeps `respondWithError` and `STATUS_BY_CODE` (both server-side) and
  re-exports the moved type so existing imports inside web don't churn.
- Web-side integration drift tests: amend each of the 4 mobile-auth
  `.int-test.ts` files + `/me`'s to call `schema.parse(responseBody)` on
  observed happy-path responses and error-path responses, asserting both
  shapes match the shared package.
- Mobile-side bundler+parse smoke test: a new `apps/mobile/__tests__/shared.test.ts`
  that imports `mobileAuthExchangeResponseSchema` from `@travel-planner/shared`,
  parses a small inline fixture, and asserts the result.
- Architecture-test drift guard: amend `apps/web/src/__tests__/architecture.test.ts`
  to walk `packages/shared/src/**/*.ts` and assert every import resolves
  either to `'zod'` or to a sibling file in the same package.
- `packages/shared/package.json` adds `"type-check": "tsc --noEmit"` so the
  root's existing `pnpm -r type-check` picks it up.
- Doc updates in the same commit: `AGENTS.md` doc-review table line for
  "A new `/api/v1/*` endpoint or error code" repoints at the shared
  package; epic §10 row "Shared types" amends the phrasing from
  "re-exports `apps/web/src/domain/**`" to the hybrid wire-shapes scope
  (logged as an epic-level deviation in §16); package name corrected
  from `@travel/shared` to `@travel-planner/shared` across the epic.

**Out of scope (deliberately):**

- Re-exporting `apps/web/src/domain/**` in any form — neither path-import
  re-exports (option a from grilling) nor a physical move of the domain
  layer into the package (option b). The package only contains wire
  shapes that already cross the network.
- `Money` / `Currency` / `Result` / `DateRange` value-object types and
  factories. Mobile doesn't need them for slice 6 (sign-in); a future
  spec lifts them if/when trips or spend ship on mobile.
- Domain entity types (`Trip`, `User`, `SpendEntry`, etc.) and repository
  port interfaces. Server-internal in the foreseeable future.
- The JWT access-token claims shape (sub/iat/exp/iss). Mobile treats the
  access token as an opaque bearer and uses `access_expires_at` from the
  response body for refresh-timing logic.
- Compiled `dist/` output, `exports` map, or any build step inside the
  package. Source-only.
- Standalone unit tests inside `packages/shared/`. Verification is
  integration-only, paid for by the existing web `.int-test.ts` files
  and one mobile bundler smoke test.

**Out of scope (deferred):**

- Per TD-004, EPIC-002's switch to direct on-device Google OAuth via
  `expo-auth-session` will reshape the mobile-auth wire shapes. The
  package's auth surface will be amended (probably substantially) at
  that point — not now.
- A separate `@travel-planner/shared-domain` package for shared
  value objects (Money, Currency, Result). Becomes interesting only
  when a non-auth mobile screen needs them.

## Acceptance signal

1. `pnpm install` from a clean checkout resolves `@travel-planner/shared`
   as a workspace dependency of both `apps/web/` and `apps/mobile/`.
2. `pnpm lint && pnpm db:check:migrations && pnpm type-check && pnpm test:unit && pnpm test:integration`
   all exit 0 from the repo root.
3. `pnpm --filter @travel-planner/mobile test` runs the bundler+parse
   smoke test and passes (proves Metro + jest-expo + zod all cooperate
   on the workspace package).
4. `pnpm build` produces a working web build with `transpilePackages`
   honouring the new package (no untranspiled-TS errors).
5. The amended web integration tests for the 4 mobile-auth endpoints +
   `/me` all `schema.parse(body)` their observed responses without error
   on happy paths, and observe the error envelope schema on error paths.
6. The architecture-test drift guard walks `packages/shared/src/**/*.ts`
   and finds zero imports outside `'zod'` + sibling files.
7. A `git grep` for the four inline `const Body = z.object` declarations
   in `apps/web/src/app/api/v1/auth/mobile/*/route.ts` returns zero hits
   after the refactor.

## Alternatives considered and rejected

| Option | Why rejected |
|--------|--------------|
| **Path-import re-export of `apps/web/src/domain/**`** (grilling Q1, option a) | Inverts the workspace dependency direction (`packages/shared` would depend on `apps/web`). Creates a silent-breakage class where any web-internal import sneaked into a re-exported domain file breaks mobile invisibly. |
| **Physical move of the relevant subset of `src/domain/` into `packages/shared/src/`** (grilling Q1, option b) | Right architectural direction but blows the 1-day budget — touches every domain import site in `apps/web/`, churns the architecture test, requires careful migration in stages, and wants its own epic-altitude decision. Deferred. |
| **Compiled `dist/` output via `tsc`** (grilling Q5, option b) | One line of Next `transpilePackages` config is cheaper than a build pipeline + CI step + `dist/` gitignore + freshness hook. Source-only matches what pnpm + Metro auto-detect on Expo SDK 54. |
| **Types-only package, request schemas stay inline in route handlers** (grilling Q3, option b) | Loses the integration-tests-over-unit principle — you can't `.parse()` something that doesn't exist at runtime. Drift detection across the wire becomes a manual code-review concern instead of an automated test failure. |
| **Standalone unit tests inside `packages/shared/`** (grilling Q6, alternate) | The package has zero behaviour of its own. Every assertion that matters is observable from one of the two integration boundaries (web side, mobile side). A standalone vitest config in `packages/shared/` would be infrastructure for no behaviour. |
| **Minimum-viable: ship only what slice 6 strictly hits** (grilling Q2, option b) | Slice 6 expands the surface immediately anyway. Cohesion argues for shipping the closed set of `/api/v1` wire shapes that exist today (six) rather than four. |
| **Package name `@travel/shared` per epic §10 wording** | Inconsistent with the rest of the monorepo (`@travel-planner/web`, `@travel-planner/mobile`). Epic prose amended in the same commit as part of the §16 epic-level deviation row. |

## Open risks

1. **Zod 4 cross-bundler compat on Expo SDK 54.** Zod 4 is ESM-first; jest-expo's
   transform pipeline should handle it, but I haven't verified zod under jest-expo
   54 specifically. Mitigation: the mobile-side smoke test will catch this
   immediately; if it breaks, fall back to pinning zod to the last cleanly
   working 3.x range and document as a known limitation.
2. **`transpilePackages` interaction with Sentry/Next instrumentation.**
   Next 16's instrumentation client wraps imports; `transpilePackages` is
   well-supported but a regression here would manifest as a build-time
   `requireOptional` or `eval` error in the Sentry path. Mitigation: web
   build is part of acceptance criteria #4 — failure surfaces before merge.
3. **The `MobileAuthCallbackError` closed union is new type rigour.** Today
   `callback/route.ts` writes the `?error=<reason>` strings as ad-hoc literals.
   Lifting them into a typed union may surface a reason that's only emitted
   in one code path and missed by the union, breaking the exhaustive switch
   on the mobile side in slice 6. Mitigation: code-walk all `Response.redirect`
   calls in `callback/route.ts` at spec time, and add a small grep-as-test
   that asserts the literals in the file match the union members.
4. **Doc-table drift in `AGENTS.md`.** The doc-review table has one row
   pointing at `apps/web/src/app/api/v1/_lib/errors.ts`; this spec moves
   half of that file. The amendment is mechanical but easy to miss in
   review. Mitigation: the spec implementation order explicitly lists it
   as a step.
5. **Architecture-test placement.** Adding the drift guard to
   `apps/web/src/__tests__/architecture.test.ts` couples a web-side test
   to a sibling package. If `apps/web/` is ever extracted, the test moves
   with it. Acceptable trade-off for slice 4: that's not a foreseeable
   move, and the test belongs with structural enforcement, which lives
   in web's suite today.

## Key answers from grilling

**Q1 — Dependency direction & physical placement.**
> Hybrid (option c). `@travel-planner/shared` contains only wire shapes
> that cross the network — DTOs, callback deep-link error union, error
> envelope. The full `apps/web/src/domain/**` does not move or re-export.
> Slice 6 doesn't need it; deferring keeps the slice inside its 1-day
> budget. (User: "C".)

**Q2 — Initial DTO surface.**
> All six wire shapes shipped at once: 4 mobile-auth req/res pairs + `/me`
> response + error envelope. Package name: `@travel-planner/shared`, not
> `@travel/shared` per epic §10 — consistency with `@travel-planner/web`
> and `@travel-planner/mobile`. Epic prose amended in the spec commit.
> (User: "Yeah call it travel-planner.")

**Q3 + Q6 — Schema runtime form, and verification approach.**
> Both runtime zod schemas (`mobileAuthExchangeRequestSchema`) and inferred
> TS types (`MobileAuthExchangeRequest`) for each wire shape. Route
> handlers in `apps/web/` import the request schemas from the shared
> package instead of declaring inline. `ApiErrorCode` + `ApiErrorBody`
> physically move to `packages/shared/src/api-errors.ts`; `respondWithError`
> stays in web with a one-line shim re-export. Integration over unit:
> web-side integration tests `schema.parse(responseBody)` on observed
> responses; mobile-side bundler+parse smoke test; no standalone unit
> tests inside `packages/shared/`. (User: "yeah approved" — with all
> three flagged points explicitly accepted.)

**Q5 — Build / dist strategy.**
> Source-only. `"main": "./src/index.ts"`, no `dist/`, no `tsc` step.
> Web adds `transpilePackages: ['@travel-planner/shared']` to
> `next.config.ts`; Expo SDK 54's stock Metro auto-handles workspace
> packages already (per ADR 053). (Implicit accept — not pushed back on.)

**Q8 — Drift guard for package internals.**
> Add a structural test inside `apps/web/src/__tests__/architecture.test.ts`
> that walks `packages/shared/src/**/*.ts` and asserts every import
> resolves to `'zod'` or a sibling file in the same package. Prevents
> the "someone adds `next/headers` to a shared file" silent-breakage
> class. (User: "Yeah add the guard and okay with Q8".)

**Q9 — CI hookup.**
> Zero changes to `.github/workflows/ci.yml`. Add `"type-check": "tsc --noEmit"`
> to `packages/shared/package.json` so the root's existing `pnpm -r type-check`
> recurses into it. Biome covers `packages/` at the workspace root already.
> (User: "Okay with CI no changes".)
