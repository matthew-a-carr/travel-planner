# iOS App Planning

> Status: exploratory. Companion to [ADR 045](decisions/045-ios-app-strategy.md),
> which is **Proposed** until a path is chosen.

This document explores how to add an iOS app to Travel Planner while keeping
the existing Next.js web app as the primary surface. It compares four routes,
recommends one, and sketches the refactor sequence that route implies.

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
  `src/application/use-cases/` are the natural unit of API exposure.
- **Composition root already exists.** `getAppContainer()` is the only runtime
  spot that constructs repositories (ADR 028). An API layer mounts here without
  touching domain or application code.
- **Strong invariants.** `Money` in pence, `Result<T, E>` for fallible domain
  operations, zod at boundaries. All of these survive transport to any client.
- **ADR culture.** Decisions are durable; a mobile strategy that fits this
  culture will land cleanly.

### Hurts

- **Server Actions are the write path.** Today the web client invokes use cases
  via `*Action` functions that ride the React Server Components transport. iOS
  cannot call server actions — they require a Next.js client embedded in a
  browser-like environment. The two HTTP routes that *do* exist are
  `src/app/api/auth/[...nextauth]/route.ts` (next-auth) and
  `src/app/api/trips/[id]/chat/route.ts` (AI streaming).
- **Cookie session authentication.** next-auth's cookie sessions are designed
  for browsers. iOS needs a token model (OAuth + PKCE → short-lived access
  token + refresh token in Keychain).
- **No public API contract.** No OpenAPI, no tRPC router, no GraphQL schema.
  An iOS client would have nothing to compile against.

The refactor question reduces to: **how do we expose the use-case layer over
HTTP without breaking the web app?** Everything downstream of that is style.

---

## 2. The "no Apple Developer account" constraint

| Without $99/yr | With $99/yr |
|---|---|
| Xcode + Simulator (free Apple ID) | TestFlight beta distribution |
| 7-day ad-hoc install on own device | App Store submission |
| Expo Go runs unsigned bundles indefinitely | Push notifications (APNs cert) |
| Develop and design the entire app | Distribute to others |

This is a distribution gate, not a development gate. All four options below are
viable during development without the account. Option A doesn't need it at all;
B, C, and D need it before public release.

---

## 3. Four routes

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
  available inside a PWA shell. Leaflet maps and Recharts won't feel native.
- **When this is the right answer:** the goal is "iPhone access, fast" and
  there is no commitment to a native UX.

### B. Capacitor — wrap the Next.js app in a native shell

Capacitor (the maintained successor to Cordova, by the Ionic team) bundles a
web app inside a WKWebView with bridges to native plugins (camera, biometrics,
push, secure storage). The web app can be served either from the bundle
("local scheme") or from Vercel ("remote scheme").

- **Refactor cost:** ~2 weeks. Add Capacitor config, ship a static slice of
  the app (or use remote scheme), implement the auth handoff between Safari
  and the WebView.
- **Pros:** One UI codebase. Reuses all current React. Plugin ecosystem is
  mature. Submission-ready when the account exists.
- **Cons:** Still a WebView. Gestures, scroll inertia, and keyboard handling
  don't match native. Apple has historically rejected pure WebView apps with
  no native integration; Ionic apps generally pass when they wire up real
  plugins. Server actions still force you to ship a thin API or to accept
  "online-only WebView".
- **When this is the right answer:** you want App Store presence eventually
  but unwilling to maintain two UIs.

### C. Expo + React Native, sharing TS via tRPC (recommended)

Keep Next.js for web. Build a separate RN app in Expo. Both clients call a
new tRPC API layer extracted from the existing use cases. tRPC is the natural
choice because the procedure signature is the use-case signature — extraction
is mechanical.

- **Refactor cost:** ~3–5 weeks of focused work, decomposable into steps that
  each ship independently.
- **Pros:**
  - Native feel (RN ships native views).
  - Expo Go means **no Apple account needed during development**.
  - Reuses every TypeScript investment: zod schemas, `Result<T, E>`, Money,
    domain types, Sentry conventions.
  - Forces an API extraction that is *valuable on its own merits* — any
    future automation, CLI, or third-party integration uses the same surface.
  - Server actions can remain as thin wrappers over the same use cases. No
    breaking change to the web app.
  - Optional Android for free later.
- **Cons:**
  - Two UI codebases (RN and web).
  - Need real mobile auth (OAuth + PKCE + Keychain). Cannot reuse the cookie
    session.
  - EAS Build (Expo's cloud build) is free for low volume; release builds
    still need the $99 to ship to actual users.
- **When this is the right answer:** you want a native-feeling app long-term
  and you value code/type reuse over UI-codebase consolidation.

### D. Native SwiftUI — separate Swift codebase against the same API

Pure Swift app. SwiftUI is mature in 2026. You still need the API layer (same
work as C). Zero TypeScript reuse unless you generate Swift models from
OpenAPI / a schema.

- **Refactor cost:** ~6–10 weeks. API extraction + SwiftUI learning curve +
  no code reuse.
- **Pros:** Best possible iOS experience. Smallest binary. First-class
  Apple platform support (Widgets, Live Activities, Lock Screen, Watch).
- **Cons:** Mac-required. Zero TS reuse. Duplicate domain validation in
  Swift. iOS-only (no Android path without yet another codebase).
- **When this is the right answer:** the iOS app is *the* product, not a
  companion to a web app.

---

## 4. Comparison

| Dimension | A. PWA | B. Capacitor | C. Expo + tRPC | D. Swift |
|---|---|---|---|---|
| Time to first install on iPhone | days | 2 weeks | 4–5 weeks | 8–10 weeks |
| Native feel | ★ | ★★ | ★★★★ | ★★★★★ |
| Code reuse with web | 100% | ~95% | ~50% (domain/types/zod) | 0% |
| Works without dev account | ✅ | ⚠ dev only | ✅ (Expo Go) | ❌ on device |
| Forces healthy API extraction | no | partial | **yes** | yes |
| Future Android | ✅ free | ✅ free | ✅ same RN code | ❌ |
| Mac required | no | no | only for release | yes |
| App Store path (with account) | ⚠ (PWABuilder) | ✅ | ✅ | ✅ |

---

## 5. Recommendation

**Option C (Expo + tRPC), with an optional A (PWA) ahead of it as a
two-week quick win.**

Justification:

1. **The API extraction is work you should do anyway.** Server actions are a
   coupling smell once any non-Next.js client is in scope — mobile, automation,
   external integrations, even a future CLI. tRPC over the existing use cases
   is the cheapest extraction because the procedure signature *is* the
   use-case signature.
2. **Expo Go neutralises the no-Apple-account constraint** for the entire
   development phase. You can build, iterate, and demo to friends without
   paying anything. The $99 is paid only when you decide it is worth shipping.
3. **RN reuses your TypeScript muscle.** zod schemas, `Result<T, E>`, Money,
   domain types, Sentry knowledge, Vercel AI streaming patterns — all carry
   over. Swift discards all of it.
4. **Migration is incremental.** Each step ships independently. The web app
   does not need to break at any point during the refactor — server actions
   can keep working while progressively delegating to the same use cases
   exposed by tRPC.
5. **The PWA quick win is non-exclusive.** It gives users an iPhone install
   path immediately, costs ~1 week, and the offline work it forces benefits
   the web product for its own sake.

---

## 6. Refactor sequence for Option C

Each numbered step is independent, has a clear exit criterion, and is small
enough to ship behind its own PR. Each one ends with the existing test suite
green.

### Step 1 — ADR + API surface inventory
- Move ADR 045 from **Proposed** to **Accepted** once a path is chosen.
- Write ADR for "tRPC as the shared API contract".
- Inventory the 50 use cases; group by mobile-day-one vs. defer.
- Define the error envelope (likely: `Result<T, E>` ⇄ HTTP).

### Step 2 — Add tRPC server to Next.js
- New route handler at `src/app/api/trpc/[trpc]/route.ts`.
- Procedures are thin wrappers that call `getAppContainer().*` and delegate
  to existing use cases. No business logic moves. No new repository code.
- Authentication on the tRPC context comes from next-auth on web (cookie) and
  from a bearer token on mobile (added in Step 4).

### Step 3 — Web app calls tRPC, keeps server actions as wrappers
- Server actions become single-line forwards to the same procedures (or
  continue to call the same use case — both clients ultimately call the same
  use case, which preserves CONSTITUTION layering).
- The web UI is untouched. Integration tests still pass against use cases.

### Step 4 — Mobile-friendly auth
- Add `/api/auth/mobile/start` (PKCE) and `/api/auth/mobile/callback`
  (issues access + refresh JWT).
- Keep next-auth cookies for web — both paths land on the same `User` row.
- Reuse the existing `access-policy` and pre-provisioning logic unchanged
  (ADR 029).

### Step 5 — Monorepo layout
- Convert to pnpm workspace if not already. `packages/shared` exports
  `src/domain/**` types and zod schemas to both apps.
- Decision needed: monorepo vs. separate repo. Recommend monorepo for atomic
  cross-cuts.

### Step 6 — Expo app scaffold
- `apps/mobile/` with Expo Router (file-based routing — same mental model
  as the App Router).
- Sentry RN, Expo SecureStore for token storage, Expo AuthSession for PKCE
  flow, `@trpc/client` for the API, TanStack Query for caching/optimistic
  updates.

### Step 7 — Core flows on iOS
- Trip list → trip detail → record spend → AI chat. Map view via
  `react-native-maps`. Charts via `victory-native` (Recharts has no RN
  equivalent that is worth fighting).

### Step 8 — Sentry, build, distribute
- Sentry RN wired through the same DSN project (or a separate one — small
  ADR worth writing).
- EAS Build for IPA generation. Without the dev account, build artifacts can
  be installed on the developer's own device using a free signing identity
  (7-day expiry).
- Defer App Store submission until the account exists.

### Step 9 — Decide on push notifications, offline, deep links
- Likely a separate ADR each, made as needs surface.

---

## 7. Decisions to defer

These do not block the strategy choice and are best made once the API is real:

- **GraphQL vs. tRPC vs. REST + OpenAPI.** tRPC is the right answer for an
  in-house TS-only client today; a future third-party API may want REST.
  These are not mutually exclusive — tRPC can coexist with REST routes.
- **Monorepo vs. separate repo.** Monorepo simplifies type sharing; separate
  repo simplifies CI and release independence.
- **Realtime/offline strategy.** Mobile users edit on planes. Conflict
  resolution semantics for offline spend entries is its own decision.
- **AI streaming on mobile.** Vercel AI SDK has RN support via `fetch`
  polyfill; specifics warrant their own validation pass.

---

## 8. Open questions for the author

- How much do you want to invest in the Apple ecosystem (Widgets, Live
  Activities, Apple Pay, Watch)? If a lot, Option D becomes more attractive.
- Is Android on the roadmap? If yes, Option D becomes less attractive.
- Is the iPhone version primarily for *you*, or for the small number of
  invited users from ADR 029? If only for the author, Option A is enough
  indefinitely.
