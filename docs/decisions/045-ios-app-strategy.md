# ADR 045: iOS App Strategy

**Date:** 2026-05-16
**Status:** Accepted (2026-05-30 — validated by EPIC-001's shipped milestone; see [ADR 058](./058-mobile-phase-2-read-only-data.md). Deferred items — TestFlight / App Store / APNs / native OAuth — remain deferred to a future strategic ADR.)

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

A full comparison, slice plan, endpoint inventory, test plan, cross-cutting
decisions, kill criteria, and open questions live in
[`docs/epics/EPIC-001-ios-app.md`](../epics/EPIC-001-ios-app.md) (ADR 049,
which operationalises this strategic ADR into shippable slices). This ADR
records the strategic choice; the epic records the execution plan.

## Decision

*Proposed:* adopt **Option C — Expo + React Native, calling plain Next.js
Route Handlers, with shared TypeScript types via a monorepo `packages/shared`
package.** PWA (Option A) is a non-exclusive optional quick win that may run
in parallel and is decided separately.

The recommendation will be promoted to *Accepted* once confirmed, at which
point this ADR will be edited to remove the "proposed" hedging and reflect
the chosen sequence.

The refactor proceeds in independent, shippable slices. Slice 0 (monorepo
restructure) shipped via ADR 046. The remaining slices and their dependency
order live in [EPIC-001 §7](../epics/EPIC-001-ios-app.md#7-vertical-slices),
with cross-cutting decisions in §10, kill criteria in §9, and the open
questions still pending in §13.

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
- **Many follow-up ADRs.** EPIC-001 §16 lists the likely ADRs each slice
  will surface (REST conventions, mobile auth, Expo, mobile testing,
  mobile observability) plus deferred ADRs (API-client layering, push
  notifications, offline strategy, deep links, App Store submission,
  mobile chart/map libraries). ADR numbers are claimed at write time, not
  pre-allocated.

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

- [`docs/epics/EPIC-001-ios-app.md`](../epics/EPIC-001-ios-app.md) —
  execution plan: slice plan, endpoint inventory, cross-cutting decisions,
  kill criteria, open questions, React Native testing strategy.
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
