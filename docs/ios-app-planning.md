# iOS App Planning

> Status: exploratory. Companion to [ADR 045](decisions/045-ios-app-strategy.md),
> which is **Proposed** until a path is chosen.

This document explores how to add an iOS app to Travel Planner while keeping
the existing Next.js web app as the primary surface. It compares four routes,
recommends one, and sketches the slice-by-slice work needed to get an
authenticated "hello world" iOS app onto the author's iPhone.

The author has a Mac but no Apple Developer Program account ($99/yr). Apple
Developer Program access changes only the *distribution* equation (TestFlight,
App Store, push notifications), not the *development* equation — Xcode and the
iOS Simulator are free, and Expo Go runs unsigned bundles on a real device
indefinitely.

---

## 1. Current state — what helps and what hurts

### Helps

- **Clean layering.** `domain → application → infrastructure → ui → app`. Use
  cases are pure TypeScript with no framework imports. The ~50 use cases in
  `src/application/use-cases/` are the natural unit of API exposure — and,
  importantly, are already the **Data Access Layer** that Vercel's own docs
  prescribe for sharing logic between Server Actions and Route Handlers.
- **Composition root already exists.** `getAppContainer()` is the only runtime
  spot that constructs repositories (ADR 028). An API layer mounts here without
  touching domain or application code.
- **Strong invariants.** `Money` in pence, `Result<T, E>` for fallible domain
  operations, zod at boundaries. All of these survive transport to any client.
- **Already on the latest Next.js.** `package.json` reports `next: 16.2.6`,
  released May 7 2026. There is no newer version to upgrade to.
- **ADR culture.** Decisions are durable; a mobile strategy that fits this
  culture will land cleanly.

### Hurts

- **Server Actions are the write path.** Today the web client invokes use cases
  via `*Action` functions that ride the React Server Components transport. **iOS
  cannot call Server Actions** — their wire format is React Flight (not JSON),
  their action IDs are content-hashed and rotate on every build, and Vercel's
  own docs state that they are not the right tool for external clients. The two
  HTTP routes that *do* exist are `src/app/api/auth/[...nextauth]/route.ts` and
  `src/app/api/trips/[id]/chat/route.ts`.
- **Cookie session authentication.** next-auth's cookie sessions are designed
  for browsers. iOS needs a token model (OAuth + PKCE → short-lived access
  token + refresh token in Keychain).
- **No public API contract.** No REST endpoints (besides the two above), no
  shared types package. An iOS client would have nothing to compile against.

The refactor question reduces to: **how do we expose the use-case layer over
HTTP without breaking the web app?**

---

## 2. The "no Apple Developer account" constraint

| Without $99/yr | With $99/yr |
|---|---|
| Xcode + Simulator (free Apple ID) | TestFlight beta distribution |
| 7-day ad-hoc install on own device | App Store submission |
| Expo Go runs unsigned bundles indefinitely | Push notifications (APNs cert) |
| Develop and design the entire app | Distribute to others |

This is a distribution gate, not a development gate. All four options below are
viable during development without the account.

---

## 3. Vercel's own prescription

From the official "Building APIs with Next.js" guide (Lee Robinson, Feb 2025):

> "Public API for Multiple Clients — You can build a public API that's consumed
> by your Next.js web app, a separate mobile app, or any third-party service.
> For example, you might fetch from `/api/users` both in your React website
> and a React Native mobile app."

And from the FAQ:

> "If you plan to use Server Actions _and_ expose a public API, we recommend
> moving the core logic to a **Data Access Layer** and calling the same logic
> from both the Server Action and the API route."

This is exactly the architecture this codebase already has. The use cases in
`src/application/use-cases/` *are* the Data Access Layer. Server Actions on
web and Route Handlers for mobile both delegate to the same use case. No use
case changes; no domain code changes; both clients converge on the same
behaviour, the same tests, the same access-policy checks (ADR 029).

This insight changes the API-layer recommendation: **plain Route Handlers are
the right answer, not tRPC or any other RPC framework.** tRPC and ts-rest
remain optional convenience layers to consider later if boilerplate becomes
painful.

---

## 4. Four routes

### A. PWA — make the web app installable

Add a Web App Manifest, a service worker, an offline strategy, and iOS splash
icons. Users tap **Share → Add to Home Screen** in Safari and get a chromeless
launcher icon. iOS 16.4+ supports Web Push for installed PWAs.

- **Refactor cost:** ~1 week. Service worker, offline cache for trip detail
  and recent spend, web-share API, viewport polish, touch-target audit.
- **Pros:** Zero duplication. Ships in days. No account needed, ever. Works
  on Android too. The existing mobile-first work (ADR 007) already paid most
  of the layout cost.
- **Cons:** Not in the App Store (irrelevant without an account, relevant
  later). iOS PWA storage is evicted aggressively. Sign in with Apple is not
  available inside a PWA shell.

### B. Capacitor — wrap the Next.js app in a native shell

Capacitor (Ionic) bundles a web app inside a WKWebView with bridges to native
plugins. Possible but rejected: still a WebView, the gesture/keyboard UX does
not justify a separate install, and the plugin model pulls in native build
complexity without delivering native UI.

### C. Expo + React Native, calling plain Route Handlers (recommended)

Keep Next.js for web. Build a separate RN app in Expo. Both clients call the
same use cases via two different transports:

- Web: existing Server Actions, unchanged.
- Mobile: new Route Handlers under `src/app/api/v1/*`, each ~10–15 lines, each
  delegating to a use case via `getAppContainer()`.

Shared TS types live in `packages/shared/`, imported by both clients.

- **Refactor cost:** ~3–5 weeks of focused work, decomposable into independent
  shippable slices (see §7).
- **Pros:**
  - Native feel (RN ships native views).
  - Expo Go means **no Apple account needed during development**.
  - Reuses every TypeScript investment: zod schemas, `Result<T, E>`, Money,
    domain types, Sentry knowledge.
  - Vercel's prescribed pattern — no new framework, no new wire protocol.
  - Server actions can remain as thin wrappers over the same use cases. No
    breaking change to the web app.
  - REST endpoints are consumable by anything else later (future automation,
    CLI, third-party integrations, Swift rewrite, etc.).
  - Optional Android for free later.
- **Cons:**
  - Two UI codebases (RN and web).
  - Need real mobile auth (OAuth + PKCE + Keychain).
  - More boilerplate per endpoint than tRPC. Mitigated by sharing TS types
    via the monorepo package; revisited as a tRPC/ts-rest decision once ~10
    endpoints exist (§10 ADR list).

### D. Native SwiftUI

Best possible iOS experience but discards all TS reuse, locks out Android,
and doubles the calendar cost. Rejected as the initial strategy; remains a
viable later move because the API surface this plan creates is transport-
agnostic — Swift can call the same Route Handlers any time.

---

## 5. Comparison

| Dimension | A. PWA | B. Capacitor | C. Expo + Route Handlers | D. Swift |
|---|---|---|---|---|
| Time to first install on iPhone | days | 2 weeks | 4–5 weeks | 8–10 weeks |
| Native feel | ★ | ★★ | ★★★★ | ★★★★★ |
| Code reuse with web | 100% | ~95% | ~50% (domain/types/zod) | 0% |
| Works without dev account | ✅ | ⚠ dev only | ✅ (Expo Go) | ❌ on device |
| Forces healthy API extraction | no | partial | **yes** | yes |
| Future Android | ✅ free | ✅ free | ✅ same RN code | ❌ |
| Mac required | no | no | only for release | yes |
| Idiomatic per Vercel docs | n/a | n/a | **yes** | yes |

---

## 6. Recommendation

**Option C: Expo + React Native, calling plain Next.js Route Handlers, with
shared TS types via a monorepo package.**

Justification:

1. **The API extraction is work you should do anyway** and is exactly what
   Vercel's own docs prescribe. Your use cases already function as the Data
   Access Layer.
2. **No new framework on the server.** Route Handlers are first-party
   Next.js. tRPC and ts-rest are deferred conveniences; revisited when
   evidence shows the boilerplate is painful.
3. **Expo Go neutralises the no-Apple-account constraint** for the entire
   development phase.
4. **TypeScript reuse is preserved** without coupling to a specific RPC
   protocol. The mobile client uses plain `fetch` with imported types.
5. **Migration is incremental and reversible.** Each slice ends with the
   existing test suite green.

A PWA quick win (Option A) can run in parallel as a one-week project — it
gives users an iPhone install path immediately and the offline work it forces
benefits the web product for its own sake. Decided independently.

---

## 7. Slices to get to "login on iPhone"

The target milestone: **the author's iPhone has the Travel Planner app
installed (via Expo Go), can sign in with Google, and displays the
authenticated user's name on screen.**

Every slice is independently shippable, ends with passing CI, and is small
enough for a single PR. Slices are listed in dependency order; some can be
parallelised (noted inline).

### Slice 0 — Monorepo restructure
- Move `src/`, `tests/`, `next.config.ts`, etc. into `apps/web/`.
- Add root `pnpm-workspace.yaml` listing `apps/*` and `packages/*`.
- Update CI paths and verification scripts.
- All existing tests pass without behavioural change.
- **ADR 046:** Monorepo layout — apps and packages structure.

### Slice 1 — REST API conventions and the first endpoint
- Add `apps/web/src/app/api/v1/me/route.ts` — `GET` returns the authenticated
  user. Accepts cookie session OR (later) bearer token.
- Define the error envelope, versioning rule, and HTTP-status mapping for
  `Result<T, E>`.
- Co-located `route.int-test.ts` covering: approved session 200,
  no-session 401, session-points-to-missing-user 401, unapproved-user 403,
  and approved-admin 200 with `isAdmin: true`. (The original plan listed
  a `410 Gone` case for a soft-deleted user; the `users` table has no
  soft-delete column, so a missing row is treated as effectively
  unauthenticated.)
- **ADR 047:** REST API conventions — versioning, error envelope, pagination,
  status-code mapping, naming.

### Slice 2 — Bearer-token authentication for Route Handlers
- New file `apps/web/src/infrastructure/auth/bearer-token.ts` — verifies a
  JWT and resolves it to the same `User` row that next-auth resolves cookies to.
- Route Handler middleware that accepts either cookie or bearer.
- No mobile-issuance yet — tokens minted via a dev CLI script for testing.
- Integration tests: valid/expired/malformed bearer; cookie path unchanged.
- **ADR 048:** Mobile authentication — PKCE OAuth flow, short-lived JWT
  access tokens, refresh tokens, Keychain storage.

### Slice 3 — Mobile OAuth issuance endpoints
- `POST /api/v1/auth/mobile/start` — accepts PKCE `code_challenge`, returns
  Google authorisation URL with state.
- `GET  /api/v1/auth/mobile/callback` — Google redirect target; exchanges code
  for Google profile, finds/creates the `User` row (subject to ADR 029 access
  policy), redirects to `travelplanner://auth?code=<one-time-code>`.
- `POST /api/v1/auth/mobile/exchange` — exchanges the one-time code +
  `code_verifier` for `{ accessToken, refreshToken, expiresAt }`.
- `POST /api/v1/auth/mobile/refresh` — rotates tokens.
- Co-located integration tests for every path.

### Slice 4 — Shared types package
- `packages/shared/` re-exports domain types and zod schemas.
- `package.json` `"exports"` field maps `@travel/shared` → re-exports of
  `apps/web/src/domain/**` and selected zod schemas.
- Web and mobile both import from `@travel/shared`.

### Slice 5 — Expo app skeleton
- `apps/mobile/` initialised with `create-expo-app`, Expo Router, TypeScript.
- One screen displays "Hello, Travel Planner". App identifier
  `dev.matthewcarr.travelplanner.dev`.
- Runs in Expo Go via QR code on the author's iPhone.
- README documents the dev loop.
- **ADR 049:** Expo as the React Native framework and distribution path
  (Expo Go for dev, EAS Build for future releases, no App Store yet).

### Slice 6 — Mobile sign-in UI and PKCE flow
- Login screen with "Sign in with Google" button.
- `expo-auth-session` handles PKCE; `expo-secure-store` persists access and
  refresh tokens in iOS Keychain.
- Universal Link / custom scheme handler captures the one-time code.
- Calls `/api/v1/auth/mobile/exchange`, stores tokens, navigates to home.

### Slice 7 — Authenticated "me" screen
- Home screen calls `GET /api/v1/me` with bearer token.
- Displays user's name and email.
- Sign-out button clears Keychain and navigates back to login.
- **This is the milestone slice.** When this slice merges, the goal is met.

### Slice 8 — Mobile testing infrastructure
- Jest with `react-native` preset configured in `apps/mobile/`.
- `@testing-library/react-native` for component tests.
- `msw/native` for mocking the API in component tests.
- Maestro installed; one E2E flow covers launch → login → see name.
- CI: Jest in every PR on Linux, Maestro on macOS runner only when
  `apps/mobile/**` changes.
- **ADR 050:** Mobile testing strategy.

### Slice 9 — Mobile observability
- Sentry RN installed; same DSN project or a dedicated one.
- Error boundary wraps the app shell.
- **ADR 051:** Mobile observability — Sentry RN, source maps via EAS,
  optional Vercel Analytics for usage.

Slices 4 and 5 are independent of 1–3 and can be done in parallel by the
same developer on different days, or by two contributors. Everything else
is sequential.

---

## 8. Endpoints to expose initially (for Slices 1–3 and 7)

Only what is needed to reach the milestone. Everything else (trips, spend,
chat, organizations, etc.) follows after the milestone is met and is its
own planning exercise.

| Method | Path | Slice | Purpose | Auth |
|---|---|---|---|---|
| GET  | `/api/v1/me` | 1 | Current user | cookie OR bearer |
| POST | `/api/v1/auth/mobile/start` | 3 | Begin PKCE flow | none |
| GET  | `/api/v1/auth/mobile/callback` | 3 | Google redirect target | none |
| POST | `/api/v1/auth/mobile/exchange` | 3 | Code + verifier → tokens | one-time code |
| POST | `/api/v1/auth/mobile/refresh` | 3 | Rotate tokens | refresh token |

### Test plan per endpoint

Every Route Handler ships with a co-located `route.int-test.ts` following the
existing `*.int-test.ts` convention (ADR 012). Each test boots a real Postgres
via Testcontainers (ADR 009) and exercises the handler in-process by
constructing a `Request` and asserting on the returned `Response`.

**`GET /api/v1/me`** —
- ✅ 200 with valid cookie session, returns minimal user shape.
- ✅ 200 with valid bearer token (post Slice 2).
- ❌ 401 with no auth.
- ❌ 401 with malformed bearer.
- ❌ 401 with expired bearer.
- ❌ 410 if user is soft-deleted (ADR 031).
- ❌ 403 if user is unapproved (ADR 029 access policy).

**`POST /api/v1/auth/mobile/start`** —
- ✅ 200 returns Google authorisation URL with `state` parameter.
- ✅ State persisted server-side keyed by `code_challenge`.
- ❌ 400 if `code_challenge` missing or malformed.

**`GET /api/v1/auth/mobile/callback`** —
- ✅ 302 redirect to `travelplanner://auth?code=<jti>` on success.
- ✅ One-time code persisted with short TTL (≤2 min) keyed to challenge.
- ✅ Subject to existing access-policy: pre-provisioned + approved.
- ❌ 400 if state missing / unrecognised.
- ❌ 403 if user not pre-provisioned.

**`POST /api/v1/auth/mobile/exchange`** —
- ✅ 200 returns `{ accessToken, refreshToken, expiresAt }`.
- ✅ One-time code invalidated after first use.
- ❌ 400 if `code_verifier` does not match stored `code_challenge`.
- ❌ 410 if code expired or already used.

**`POST /api/v1/auth/mobile/refresh`** —
- ✅ 200 returns new access + refresh tokens; old refresh token rotated.
- ❌ 401 if refresh token unknown or expired.
- ❌ 401 if refresh token reuse detected (rotation invariant — revoke family).

Total test count for the milestone: ~25 integration tests. None require a
running server (handlers are imported and called directly).

---

## 9. React Native testing strategy

The author specifically asked about RN testing because automation by AI is a
core workflow. This section answers what's available and what we'll adopt.

### 9.1 The landscape in 2026

| Layer | Tool | Notes |
|---|---|---|
| Unit / component | **Jest + `react-native` preset** | The de facto standard. Mocks native modules, supports Hermes, runs in CI on Linux. |
| Component DOM-style | **@testing-library/react-native** | Same mental model as RTL on web. Query by text / role / testID, fire events, assert. |
| API mocking | **MSW (`msw/native`)** | Intercepts `fetch`. Same handlers work for web and mobile if you keep the API shape shared. |
| Snapshot | Jest built-in | Useful for component shape, but prefer behavioural assertions. |
| Visual regression | **Storybook for React Native** + Chromatic | Optional. |
| E2E | **Maestro** (recommended) or Detox or Appium | See below. |
| CI runner | macOS for iOS Simulator E2E; Linux for everything else | macOS is ~10× the cost of Linux on GitHub Actions. |

### 9.2 Vitest vs Jest in `apps/mobile/`

Tempting to use Vitest everywhere for consistency with `apps/web/`. The
honest call: **use Jest in `apps/mobile/`**. The RN ecosystem (Metro bundler,
native module mocks, the Expo test config presets) assumes Jest. Vitest
support exists but is fringe and adds friction that does not pay off for a
solo project. Two test runners is a tiny cost; fighting the RN ecosystem
isn't.

### 9.3 Maestro vs Detox for E2E

| | Maestro | Detox |
|---|---|---|
| Test format | YAML flows | JavaScript |
| Learning curve | tiny | substantial |
| Power ceiling | medium | high |
| Setup | trivial | involved |
| LLM authorship | **very good** | OK |
| iOS Simulator | ✅ | ✅ |
| Real device | ✅ | ✅ |
| CI fit | macOS runner, ~5 min | macOS runner, ~5 min |

**Choose Maestro.** The YAML schema is small enough that Claude Code can
write a complete flow without hallucinating selectors, especially with
consistent `testID` discipline.

Example flow (`apps/mobile/.maestro/login.yaml`):

```yaml
appId: dev.matthewcarr.travelplanner.dev
---
- launchApp
- tapOn: "Sign in with Google"
- tapOn:
    id: "google-account-picker"
    index: 0
- assertVisible: "Hello,"
```

### 9.4 What runs in CI

| Job | Tool | Runner | Trigger |
|---|---|---|---|
| `mobile-typecheck` | tsc | Linux | `apps/mobile/**` changes |
| `mobile-lint` | Biome | Linux | `apps/mobile/**` changes |
| `mobile-unit-test` | Jest + RNTL | Linux | `apps/mobile/**` changes |
| `mobile-e2e` | Maestro on iOS Simulator | macOS | `apps/mobile/**` changes |

Path filters keep web-only PRs fast. Mobile jobs do not block web-only
deploys.

### 9.5 Test discipline

- Every interactive element gets a stable `testID`. Maestro flows reference
  these rather than text where text might be translated or change.
- Unit/component tests live next to the component (`Foo.tsx` →
  `Foo.test.tsx`), mirroring the existing convention.
- Maestro flows live under `apps/mobile/.maestro/flows/`, one YAML file per
  user journey.
- Snapshot tests permitted but discouraged unless the assertion is genuinely
  about *shape*. Prefer "what the user sees" assertions.
- API contract tests live with the Route Handler (server side), not with
  the mobile app — the mobile app trusts the contract; the server enforces it.

### 9.6 AI-driven authoring fit

- Jest + RNTL: identical to web RTL. Claude already writes this idiom.
- Maestro YAML: small, declarative, predictable — well-suited to LLM
  authoring. Better than Detox's JS-based DSL for this purpose.
- Co-location with component / handler: Claude can find the test next to
  the code without traversal.
- Path-filtered CI: Claude gets clear pass/fail signal per platform.

---

## 10. ADRs to be written

Each upcoming ADR is written when its slice is started, not before. They
land **Proposed** at the start of the slice and **Accepted** when the slice
merges.

| ADR | Title | Triggered by | Slice |
|---|---|---|---|
| 045 | iOS App Strategy | (overarching) | this doc — already exists |
| 046 | Monorepo Layout: apps/ and packages/ | Slice 0 | 0 |
| 047 | REST API Conventions: versioning, error envelope, status mapping | Slice 1 | 1 |
| 048 | Mobile Authentication: PKCE + JWT + Keychain | Slice 2 | 2–3 |
| 049 | Expo as the React Native Framework and Distribution Path | Slice 5 | 5 |
| 050 | Mobile Testing Strategy: Jest + RNTL + MSW + Maestro | Slice 8 | 8 |
| 051 | Mobile Observability: Sentry React Native | Slice 9 | 9 |

Possible later ADRs (post-milestone, deferred):

- API client strategy on mobile — plain `fetch` vs. tRPC vs. ts-rest, decided
  once ~10 endpoints exist and the boilerplate cost is measurable.
- Push notifications (requires Apple Developer Program).
- Offline strategy and conflict resolution.
- Deep links and Universal Links.
- App Store submission and signing.
- PWA (Option A) — if pursued in parallel.
- Mobile chart and map library selection (Recharts and Leaflet do not work
  in RN; Victory Native and react-native-maps are the likely answers; one
  ADR each).

---

## 11. Decisions to defer

These do not block the strategy choice and are best made when the need is
concrete:

- **GraphQL vs. tRPC vs. ts-rest vs. plain Route Handlers** for v2 of the API.
  Default for v1 is plain Route Handlers (this doc). Revisit after ~10
  endpoints exist.
- **Realtime/offline strategy.** Conflict resolution for offline spend
  entries deserves its own design pass.
- **AI streaming on mobile.** The existing `/api/trips/[id]/chat` endpoint
  works for any client; specifics of RN consumption (the `fetch` polyfill,
  buffering, cancellation) warrant their own validation.

---

## 12. Open questions for the author

- Is Android on the roadmap eventually? If yes, the Expo choice pays off
  twice. If no, Option D (Swift) becomes more attractive long-term.
- How much do you want to invest in iOS-specific features (Widgets, Live
  Activities, Apple Pay, Watch)? If a lot, plan a Swift migration once the
  API is stable.
- Is the iPhone version primarily for *you*, or for the small number of
  invited users from ADR 029? If only for the author, Option A (PWA) is
  sufficient indefinitely and Option C is over-investment.
- Are you willing to pay $99/yr for Apple Developer Program once the app is
  shipping-ready, or is Expo Go on personal device the indefinite plan?
