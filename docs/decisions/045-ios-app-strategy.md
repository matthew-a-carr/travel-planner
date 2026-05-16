# ADR 045: iOS App Strategy

**Date:** 2026-05-16
**Status:** Proposed

## Context

Travel Planner today is a Next.js 16.2.6 web application deployed on Vercel,
with clean layering enforced by architecture tests (ADR 028): a pure-TS
`domain` layer, ~50 use cases in `application`, Drizzle/Postgres in
`infrastructure`, and an RSC + Server Actions UI. There is no mobile client.
The two HTTP endpoints that exist are next-auth (`/api/auth/[...nextauth]`)
and the AI chat stream (`/api/trips/[id]/chat`); every write path is a Server
Action.

The author wants an iOS app while keeping the existing web app. The author
has a Mac but no Apple Developer Program subscription, which constrains
distribution (TestFlight, App Store, APNs push) but not development (Xcode,
Simulator, Expo Go all work for free).

### Why Server Actions cannot be reused for iOS

Server Actions are an internal Next.js RPC mechanism. The wire format is
React Flight (not JSON). The action ID is content-hashed at build time and
rotates on every deploy. The `allowedOrigins` config option exists for CSRF
protection between trusted browser origins, not for opening the protocol
to external clients. Vercel's own documentation states explicitly:

> "If you plan to use Server Actions _and_ expose a public API, we recommend
> moving the core logic to a Data Access Layer and calling the same logic
> from both the Server Action and the API route."
> — [Building APIs with Next.js, Vercel (2025)](https://nextjs.org/blog/building-apis-with-nextjs)

This codebase already has that Data Access Layer: the ~50 use cases in
`src/application/use-cases/`. The mobile-client problem reduces to adding
Route Handlers that delegate to the same use cases the existing Server
Actions delegate to.

### Routes considered

- **A. PWA** — add manifest + service worker; users install from Safari.
- **B. Capacitor** — wrap the existing Next.js app in a native WebView shell.
- **C. Expo + React Native, calling plain Next.js Route Handlers** — separate
  native app sharing TS domain types via a monorepo package and consuming
  a new REST API extracted from the existing use cases.
- **D. Native SwiftUI** — Swift app against the same extracted REST API.

A full comparison, slice-by-slice refactor plan, endpoint inventory, test
plan, and React Native testing strategy live in
[`docs/ios-app-planning.md`](../ios-app-planning.md). This ADR records the
strategic choice once made; until then it captures the framing and the
default recommendation so future contributors land on the same context.

## Decision

*Proposed:* adopt **Option C — Expo + React Native, calling plain Next.js
Route Handlers, with shared TypeScript types via a monorepo `packages/shared`
package.** PWA (Option A) is a non-exclusive optional quick win that may run
in parallel and is decided separately.

The recommendation will be promoted to *Accepted* once confirmed, at which
point this ADR will be edited to remove the "proposed" hedging and reflect
the chosen sequence.

The refactor will proceed in independent, shippable slices. The full slice
plan is in the planning doc; the headline sequence to reach an installed
authenticated iOS app on the author's iPhone is:

0. Restructure to a pnpm monorepo with `apps/web/`, `apps/mobile/`, and
   `packages/shared/`. (**ADR 046**)
1. Add the first Route Handler — `GET /api/v1/me` — alongside a co-located
   integration test. Define REST conventions: versioning prefix, error
   envelope, status-code mapping for `Result<T, E>`. (**ADR 047**)
2. Add bearer-token authentication accepted by Route Handlers in parallel
   with the existing next-auth cookie session. (**ADR 048**)
3. Add the four mobile OAuth endpoints implementing PKCE → JWT issuance,
   refresh-token rotation, and reuse detection. Reuses ADR 029's access
   policy unchanged.
4. Add `packages/shared/` re-exporting domain types and zod schemas.
5. Scaffold the Expo app under `apps/mobile/` with Expo Router. (**ADR 049**)
6. Implement mobile sign-in UI consuming the PKCE endpoints; store tokens in
   iOS Keychain via `expo-secure-store`.
7. Implement an authenticated "me" screen — the milestone slice.
8. Stand up mobile testing infrastructure: Jest + `@testing-library/
   react-native` + `msw/native` for component tests; Maestro for E2E flows
   against iOS Simulator. Path-filtered CI keeps web-only PRs fast.
   (**ADR 050**)
9. Wire Sentry React Native for observability. (**ADR 051**)

Server Actions remain unchanged throughout. The web client continues to
behave identically; both clients converge on the same use cases.

App Store submission and APNs push are out of scope for the initial
milestone and require the $99/yr Apple Developer Program account. Expo Go
on the author's own iPhone is the development and personal distribution
path until that account is acquired.

## Consequences

- **Forces a healthy API extraction** that is independently valuable —
  any future automation, CLI, third-party integration, or Swift rewrite
  uses the same surface. The Server Action coupling is removed without
  removing Server Actions; they become a transport detail of the web client.
- **Idiomatic per Vercel's own guidance.** No new RPC framework on the
  server — plain Route Handlers, the first-party Next.js mechanism.
- **TypeScript reuse is preserved** without coupling to a specific RPC
  protocol. Mobile uses plain `fetch` with imported types from
  `packages/shared`. The decision to layer tRPC or ts-rest on top is
  deferred and revisited when ~10 endpoints exist and the boilerplate
  cost is measurable.
- **Two UI codebases** to maintain (RN and Next.js). Tolerable because the
  domain layer, zod schemas, `Result<T, E>`, and Money types are shared.
- **Mobile auth is new work.** Cookie sessions cannot be reused. PKCE +
  short-lived JWT + Keychain refresh-token rotation is the standard
  pattern, codified in ADR 048.
- **No Apple account is needed for development.** Expo Go runs unsigned
  bundles on a real iPhone indefinitely; the $99/yr Apple Developer
  Program is required only for App Store distribution and APNs push,
  both of which are out of scope for the initial milestone.
- **Migration is incremental and reversible.** Each slice ends with the
  existing test suite green. The web app does not break at any point.
- **Future Android is free** via the same RN codebase.
- **Native ceiling.** RN cannot match SwiftUI for Widgets, Live Activities,
  Lock Screen, or Watch fidelity. If those become product priorities, a
  future ADR can supersede this one and migrate to Swift against the same
  Route Handlers (the API survives the UI swap because it is plain REST).
- **Many follow-up ADRs.** The planning doc enumerates ADRs 046–051 plus a
  set of deferred ADRs (API-client layering, push notifications, offline
  strategy, deep links, App Store submission, mobile chart/map libraries).

## Alternatives considered

- **Option A (PWA only).** Cheapest path. Ships in days. Rejected as the
  long-term answer because iOS PWA storage is evicted aggressively, Sign
  in with Apple is unavailable in the PWA shell, and the experience is
  visibly "web-y" for map and chart-heavy screens. Retained as an optional
  quick win alongside C.
- **Option B (Capacitor).** Wraps the existing web app. Rejected because
  Apple has historically pushed back on pure-WebView apps and because the
  WebView UX (scroll, gestures, keyboard) does not justify a separate
  install over a PWA. The plugin model pulls in native build complexity
  without delivering native UI.
- **Option D (Swift).** Best possible iOS experience. Rejected as the
  initial strategy because it discards all TypeScript reuse, requires
  duplicating domain validation in Swift, locks out the Android path, and
  doubles the calendar cost versus Option C. Remains the right answer if
  the iOS app ever becomes the primary product surface — and is reachable
  later without rework because the REST API is transport-agnostic.
- **tRPC or ts-rest as the API layer for v1.** Considered and rejected for
  the initial sequence. tRPC would save boilerplate but is not what Vercel
  documents as the recommended pattern, adds a framework dependency before
  evidence of pain, and slightly reduces REST portability. ts-rest is the
  strongest alternative if and when boilerplate becomes painful; deferred
  to a future ADR.
- **Reverse-engineering Server Actions for iOS.** Rejected. Action IDs are
  content-hashed and rotate on every build; the Flight wire format is not
  a stable public API; this would tightly couple the iOS app to private
  Next.js internals.
- **Doing nothing.** The web app is already mobile-first (ADR 007) and
  works on iPhone Safari. Rejected because the author has stated the goal
  of an installed iOS app.

## References

- [`docs/ios-app-planning.md`](../ios-app-planning.md) — long-form planning
  doc with comparison tables, slice-by-slice refactor plan, endpoint
  inventory, test plan per endpoint, and React Native testing strategy.
- [Building APIs with Next.js (Vercel, Feb 2025)](https://nextjs.org/blog/building-apis-with-nextjs)
- [Server Actions config reference (Next.js docs)](https://nextjs.org/docs/app/api-reference/config/next-config-js/serverActions)
- ADR 007 — mobile-first responsive design (existing layout investment).
- ADR 012 — integration test file naming convention `.int-test.ts`.
- ADR 028 — composition-root DI container (the mount point for the new API).
- ADR 029 — closed auth with admin pre-provisioned membership (reused by
  the mobile auth flow unchanged).
- ADR 031 — soft-delete user anonymization (the `/me` endpoint must respect).
- ADR 040 — Vercel AI Gateway (the AI streaming surface that mobile must
  eventually support, deferred past the initial milestone).
