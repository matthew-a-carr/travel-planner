# ADR 045: iOS App Strategy

**Date:** 2026-05-16
**Status:** Proposed

## Context

Travel Planner today is a Next.js 16 web application deployed on Vercel, with
clean layering enforced by architecture tests (ADR 028): a pure-TS `domain`
layer, ~50 use cases in `application`, Drizzle/Postgres in `infrastructure`,
and an RSC + Server Actions UI. There is no mobile client. The two HTTP
endpoints that exist are next-auth (`/api/auth/[...nextauth]`) and the AI
chat stream (`/api/trips/[id]/chat`); every write path is a Server Action.

The author wants an iOS app while keeping the existing web app. The author
has a Mac but no Apple Developer Program subscription, which constrains
distribution (TestFlight, App Store, APNs push) but not development (Xcode,
Simulator, Expo Go all work for free).

Four routes are viable:

- **A. PWA** — add manifest + service worker; users install from Safari.
- **B. Capacitor** — wrap the existing Next.js app in a native WebView shell.
- **C. Expo + React Native + tRPC** — separate native app sharing TS domain
  types and a new tRPC API extracted from the existing use cases.
- **D. Native SwiftUI** — Swift app against the same extracted API.

A full comparison, refactor sequence, and trade-off analysis live in
[`docs/ios-app-planning.md`](../ios-app-planning.md). This ADR records the
strategic choice once made; until then it captures the framing and the
default recommendation so future contributors land on the same context.

## Decision

*Proposed:* adopt **Option C (Expo + React Native, sharing TypeScript via a
new tRPC API)** as the iOS strategy, with **Option A (PWA)** as an optional
non-exclusive quick win that ships ahead of C.

The recommendation will be promoted to *Accepted* once confirmed, at which
point this ADR will be edited to remove the "proposed" hedging and reflect
the chosen sequence.

The refactor will proceed in independent, shippable steps:

1. Inventory API surface and write a sibling ADR for "tRPC as the shared
   API contract".
2. Add a tRPC router at `src/app/api/trpc/[trpc]/route.ts` that delegates
   to existing use cases via `getAppContainer()`. No business logic moves.
3. Migrate web Server Actions to thin wrappers over the same procedures (or
   over the same use cases directly). Both clients ultimately call the same
   use case, preserving CONSTITUTION layering.
4. Add mobile auth: OAuth + PKCE → short-lived JWT + refresh token, stored
   in iOS Keychain. next-auth cookie sessions remain unchanged for web; both
   paths land on the same `User` row and reuse the ADR 029 access policy.
5. Convert to a pnpm workspace; `packages/shared` exports domain types and
   zod schemas to both apps.
6. Scaffold Expo Router app under `apps/mobile/`. Use Expo SecureStore,
   AuthSession, `@trpc/client`, TanStack Query, Sentry RN.
7. Implement core flows on iOS (trips list, trip detail, record spend, AI
   chat, map). Defer push, offline, and Widgets to dedicated ADRs.
8. Defer App Store submission until an Apple Developer Program account
   exists. Development through Expo Go does not require one.

## Consequences

- **Forces a healthy API extraction** that is independently valuable —
  any future automation, CLI, or third-party integration uses the same
  surface. The Server Action coupling is removed without removing Server
  Actions; they become a transport detail of the web client.
- **Two UI codebases** to maintain (RN and Next.js). Tolerable because the
  domain layer, zod schemas, `Result<T, E>`, and Money types are shared.
- **Mobile auth is new work**. Cookie sessions cannot be reused. PKCE +
  short-lived JWT + Keychain refresh token is the standard pattern.
- **No Apple account is needed for development**. Expo Go runs unsigned
  bundles on a real iPhone indefinitely; the $99/yr Apple Developer Program
  is required only for App Store distribution and APNs push, both of which
  are out of scope for the initial milestone.
- **Migration is incremental and reversible.** Each step ends with the
  existing test suite green. The web app does not break at any point in
  the sequence.
- **Future Android is free.** The same RN codebase ships to Play Store
  if and when the author wants it.
- **Native ceiling.** RN cannot match SwiftUI for Widgets, Live Activities,
  Lock Screen, or Watch app fidelity. If those become product priorities,
  a future ADR can supersede this one and migrate to Swift against the
  same tRPC API (the API survives the UI swap).

## Alternatives considered

- **Option A (PWA only).** Cheapest path. Ships in days. Rejected as the
  long-term answer because iOS PWA storage is evicted aggressively, Sign
  in with Apple is unavailable in the PWA shell, and the experience is
  visibly "web-y" for map and chart-heavy screens. Retained as an optional
  quick win alongside C.
- **Option B (Capacitor).** Wraps the existing web app. Rejected because
  Apple has historically pushed back on pure-WebView apps and because the
  WebView UX (scroll, gestures, keyboard) does not justify a separate
  install over the PWA. The plugin model also pulls in native build
  complexity without delivering native UI.
- **Option D (Swift).** Best possible iOS experience. Rejected as the
  initial strategy because it discards all TypeScript reuse, requires
  duplicating domain validation in Swift, locks out the Android path, and
  doubles the calendar cost versus Option C. Remains the right answer if
  the iOS app ever becomes the primary product surface.
- **Doing nothing.** The web app is already mobile-first (ADR 007) and
  works on iPhone Safari. Rejected because the author has stated the goal
  of an installed iOS app and because the PWA quick win is cheap enough
  to justify on its own.

## References

- [`docs/ios-app-planning.md`](../ios-app-planning.md) — long-form planning
  doc with comparison tables, time estimates, and the full Step 1–9 refactor
  sequence.
- ADR 007 — mobile-first responsive design (existing layout investment).
- ADR 028 — composition-root DI container (the mount point for the new API).
- ADR 029 — closed auth with admin pre-provisioned membership (reused by
  the mobile auth flow unchanged).
- ADR 040 — Vercel AI Gateway (the AI streaming surface that mobile must
  support).
