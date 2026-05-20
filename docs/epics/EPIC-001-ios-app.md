# EPIC-001: iOS App — Expo + React Native against extracted REST API

**Date:** 2026-05-20
**Status:** Draft
**Strategic ADR:** [045 — iOS App Strategy](../decisions/045-ios-app-strategy.md)
**Owner:** Matt Carr
**Approved by:** —

> This epic operationalises ADR 045. It supersedes the previous freeform
> planning doc `docs/ios-app-planning.md` (now removed) and adopts the
> structured epic format (ADR 049). Slice 0 (monorepo restructure) is
> already shipped via ADR 046.

---

## 1. Vision

The author opens the Travel Planner app on their iPhone — installed via
Expo Go, no App Store, no Apple Developer Program — signs in with Google,
and sees their own trips, spend, and AI itinerary chat in a native shell.
The web app continues to work unchanged; both clients call the same use
cases via different transports.

## 2. Why now

The web app is mobile-first (ADR 007) and works on Safari, but an installed
native app is a step-change in how often it gets used. The clean
layering — pure-TS `domain`, ~50 use cases in `application`, composition-
root DI (ADR 028) — has been quietly the Data Access Layer that Vercel's
own docs prescribe for sharing logic between Server Actions and REST. The
work to expose use cases over HTTP is independently valuable (future
automation, CLI, third-party integrations) and the right moment to do it
is before more business logic accretes in Server Action wrappers.

See ADR 045 for the full strategic analysis (PWA vs Capacitor vs Expo vs
Swift comparison, no-Apple-Dev-Program constraint, deferred-decision
rationale).

## 3. Definition of done

The epic is **Complete** when:

- [ ] The author's iPhone has the Travel Planner app installed via Expo Go.
- [ ] The author signs in with Google using PKCE → JWT in iOS Keychain.
- [ ] The home screen shows the authenticated user's name (the milestone
      slice).
- [ ] Mobile testing infrastructure exists: Jest + RNTL component tests run
      in CI on Linux; Maestro E2E runs on macOS only when `apps/mobile/**`
      changes.
- [ ] Sentry React Native is wired with source maps via EAS.
- [ ] The web app behaves identically to today (no regression).
- [ ] All pre-existing tests stay green at every slice merge.

Trips, spend, chat, organisations, and any post-milestone screens are
**not** the bar for this epic — they're follow-up epics built on the
foundation this one creates.

## 4. Demo script

1. On a freshly cloned repo, run `pnpm install && pnpm dev` — web app
   serves at `localhost:3000` unchanged.
2. On the same machine, run `pnpm --filter mobile start`. Scan the QR code
   on the author's iPhone via Expo Go.
3. The Travel Planner app launches. Tap **Sign in with Google**.
4. Complete the OAuth flow in the system browser (PKCE).
5. The app deep-links back, exchanges the one-time code for tokens, stores
   them in Keychain, and lands on the home screen.
6. The home screen shows **"Hello, Matt"** — fetched from
   `GET /api/v1/me` with the bearer token.
7. Tap **Sign out**. Tokens are cleared from Keychain. The login screen
   returns.

## 5. Outcome / success criteria

1. The web client and mobile client both delegate to the same use cases via
   `getAppContainer()` — no use case has been duplicated or forked.
2. The mobile auth flow follows PKCE + short-lived JWT access tokens +
   rotating refresh tokens stored in iOS Keychain, with refresh-token reuse
   detection.
3. The REST API is versioned (`/api/v1/*`), uses a consistent error
   envelope, and maps `Result<T, E>` to HTTP status codes by a documented
   rule.
4. Shared TypeScript types live in `packages/shared/` and are imported by
   both `apps/web/` and `apps/mobile/`.
5. CI on a web-only PR completes without running any mobile job (path
   filters).

## 6. Non-goals

- **App Store submission.** Requires Apple Developer Program ($99/yr) and
  is explicitly deferred. Distribution is Expo Go on the author's own
  iPhone for the entire epic.
- **Push notifications (APNs).** Same reason. Deferred.
- **Trips / spend / chat / organisations screens on mobile.** Each is its
  own follow-up epic. This epic stops at authenticated "me".
- **Offline mode and conflict resolution.** Has its own design pass; not in
  this epic.
- **Native iOS features** — Widgets, Live Activities, Lock Screen, Watch,
  Apple Pay. Out of scope; if these become priorities, ADR 045's
  consequences section flags Swift migration as the future answer.
- **Android.** Free side-effect of Expo, but not validated in this epic.
- **tRPC / ts-rest / GraphQL.** v1 of the API is plain Route Handlers per
  Vercel's own guidance. Layered RPC libraries are deferred to a separate
  ADR once ~10 endpoints exist.
- **PWA work.** Optional parallel quick win per ADR 045; decided
  independently of this epic.
- **Replacing Server Actions on web.** They stay as the web write path;
  they simply become a transport detail.

## 7. Vertical slices

Slice 0 (monorepo restructure) shipped via ADR 046 and is not repeated
here. The remaining slices reach the milestone (slice 7) and harden the
foundation (slices 8–9). Slices 4 and 5 are independent of 1–3 and can run
in parallel.

| # | Slice | Demo script line(s) | Becomes SPEC | Depends on | Status |
|---|-------|---------------------|--------------|------------|--------|
| 0 | Monorepo restructure (`apps/web/`, `apps/mobile/`, `packages/*`) | n/a — invisible | _shipped, ADR 046_ | — | **Done** |
| 1 | REST API conventions + first endpoint `GET /api/v1/me` (cookie auth only) | (foundation for line 6) | _not yet planned_ | 0 | Not started |
| 2 | Bearer-token auth alongside cookie sessions | (foundation for line 6) | _not yet planned_ | 1 | Not started |
| 3 | Mobile OAuth endpoints (PKCE start / callback / exchange / refresh) | (foundation for lines 3–5) | _not yet planned_ | 2 | Not started |
| 4 | `packages/shared/` re-exports domain types + zod schemas | (foundation for line 6) | _not yet planned_ | 0 (parallel to 1–3) | Not started |
| 5 | Expo app skeleton in `apps/mobile/` — runs in Expo Go, shows "Hello, Travel Planner" | line 2 | _not yet planned_ | 0 (parallel to 1–3) | Not started |
| 6 | Mobile sign-in UI + PKCE flow + Keychain | lines 3–5 | _not yet planned_ | 3, 5 | Not started |
| 7 | Authenticated "me" screen + sign-out (**milestone slice**) | lines 6–7 | _not yet planned_ | 4, 6 | Not started |
| 8 | Mobile testing infrastructure — Jest + RNTL + msw/native + Maestro + path-filtered CI | n/a — invisible | _not yet planned_ | 7 | Not started |
| 9 | Mobile observability — Sentry RN + EAS source maps | n/a — invisible | _not yet planned_ | 7 | Not started |

SPECs for each slice are created via `plan-feature` only when that slice is
ready to begin. Earlier slices may be planned in detail; later slices stay
intentionally vague until the preceding learnings come in.

## 8. Sequencing rationale

- **1 → 2 → 3** is a hard chain: REST conventions before any endpoint;
  bearer auth before any endpoint that needs mobile auth; mobile-OAuth
  endpoints sit on top of bearer auth. Decoupling these would either
  pre-commit conventions before the first endpoint pressure-tests them, or
  build mobile endpoints on a cookie session iOS can't carry.
- **4 (shared types) and 5 (Expo skeleton)** can run in parallel with 1–3.
  Both are independently shippable to a "Hello, Travel Planner" demo and
  unblock slice 6 only.
- **6 (mobile sign-in)** is the bottleneck. It depends on both the server
  side (slices 1–3) and the mobile shell (slice 5). It is the single most
  uncertain slice; budget loosely.
- **7 (milestone)** is small once 6 lands.
- **8 (testing) and 9 (observability)** are post-milestone hardening. Doing
  them before the milestone would gold-plate before there's anything to
  protect; doing them too long after risks the foundation drifting without
  guardrails.

Sequence reversibility: slices 4, 5, 8, 9 are reversible without rework
elsewhere. Slices 1–3 are not — their conventions land deeply in the
API surface.

## 9. Kill / pivot criteria

- **If mobile OAuth integration (slice 3 or 6) reveals that the Vercel
  Functions environment cannot complete the PKCE callback within the
  Hobby-tier execution limits or cold-start budget**, pivot to A: PWA-only
  for installed iPhone access; defer native to when an Apple Developer
  Program account is funded.
- **If slice 7 reaches "Hello, name" but Expo Go on a real iPhone proves
  too brittle for daily use** (frequent disconnects, manual re-pairing
  after every iOS update), kill slice 8 onwards and either fund the Apple
  Developer Program ($99/yr) for EAS Build-signed dev builds, or revert
  to PWA.
- **If the boilerplate per Route Handler hits ~20 lines and ~10 endpoints
  with significant duplication**, do not continue past slice 7 without a
  separate ADR considering ts-rest / tRPC layering.
- **If two consecutive slices each exceed twice their estimated calendar
  budget**, pause and re-plan rather than push through.

## 10. Cross-cutting decisions

These are settled at the epic level. Child SPECs inherit them and must not
re-litigate without flagging an epic-level deviation (§16).

| Concern | Decision | Why |
|---------|----------|-----|
| API transport | Plain Next.js Route Handlers under `/api/v1/*`. No tRPC / ts-rest / GraphQL in v1. | ADR 045 + Vercel's "Building APIs with Next.js" — first-party, no framework dependency, REST portability for any future client. Layered RPC revisited via separate ADR once boilerplate cost is measurable. |
| API versioning | URL prefix `/api/v1/`. Breaking changes ship under `/api/v2/`. | Trivial to implement, transparent to operators, no header / negotiation complexity. |
| Error envelope | `{ "error": { "code": "snake_case", "message": "human-readable", "details": {...} } }`. | Predictable for any client; matches existing Sentry breadcrumb shape. (Codified in the slice 1 SPEC and the slice 1 ADR.) |
| `Result<T, E>` → HTTP mapping | Documented in the slice 1 ADR. Domain errors → 4xx; infra errors → 5xx; success → 2xx with the success variant in body. | One rule, applied everywhere; no per-endpoint inventiveness. |
| Auth on Route Handlers | Cookie session OR bearer token — both resolve to the same `User` row. Existing ADR 029 access policy applies unchanged. | Lets web keep using next-auth cookies and mobile use JWTs without forking authorisation logic. |
| Mobile auth model | PKCE → short-lived JWT access tokens + rotating refresh tokens with reuse detection. Tokens stored in iOS Keychain via `expo-secure-store`. | Standard mobile-OAuth pattern; refresh rotation + reuse detection contains stolen-token blast radius. |
| Mobile framework | Expo + React Native, Expo Router. Distribution: Expo Go for development; EAS Build deferred until Apple Developer Program is funded. | ADR 045. |
| Shared types | `packages/shared/` workspace package. Re-exports `apps/web/src/domain/**` and selected zod schemas. Both clients import from `@travel/shared`. | Single source of truth for types without coupling to a specific RPC protocol. |
| Mobile test runner | Jest in `apps/mobile/`. Vitest stays in `apps/web/`. | RN ecosystem assumes Jest; fighting it for runner consistency is not worth it. |
| Mobile E2E | Maestro YAML on iOS Simulator, path-filtered macOS CI job. | Small declarative schema → reliable LLM authorship; cheaper macOS minutes via path filter. |
| Observability | Sentry React Native, same vendor as web (ADR 032). Source maps via EAS. | One observability story across surfaces. |
| Security & data classification | Same access policy as web (ADR 029). No new PII flows. Tokens never logged. | Reuses settled policy; explicit no-new-PII keeps the slice 1 / 3 reviews scoped. |

## 11. External dependencies & constraints

| Dependency | What we rely on | Constraint / status |
|------------|-----------------|---------------------|
| **Apple** | iPhone runs Expo Go; iOS Simulator runs Maestro flows. | **No Apple Developer Program account.** Free Apple ID is sufficient for development. Means: no TestFlight, no App Store, no APNs push, no signed dev builds beyond 7-day ad-hoc. Expo Go runs unsigned bundles indefinitely. |
| **Google OAuth** | PKCE flow on mobile uses the existing Google OAuth client (or a separate iOS-scoped client). | Need to register a redirect URI for the mobile callback. iOS may require Sign in with Apple too — to be revisited if/when App Store entry is on the table. |
| **Expo / EAS** | Expo Go for dev distribution; EAS Build deferred. | EAS has a free tier sufficient for our cadence; only relevant when we move past Expo Go. |
| **Sentry** | RN SDK reports to the same Sentry project as web. | Existing org / project; source-map upload via EAS only matters when EAS Build is funded. |
| **Vercel** | Hosts the Route Handlers under `/api/v1/*`. | Hobby tier execution / cold-start limits constrain the PKCE callback latency. Flagged in §9 kill criteria. |
| **GitHub Actions** | Linux runners for web + mobile typecheck / lint / unit; macOS runner only for mobile E2E. | macOS minutes are ~10× Linux. Path filter on `apps/mobile/**` is mandatory. |

## 12. Cost & budget

| Item | Cost | When incurred | Decision |
|------|------|---------------|----------|
| Apple Developer Program | $99/yr | If/when TestFlight, App Store, or APNs is needed | **Deferred.** Not part of this epic. |
| EAS Build | Free tier first; ~$29/mo paid tier later | Only when EAS Build replaces Expo Go | **Deferred.** Not part of this epic. |
| GitHub Actions macOS minutes | ~$0.08 per minute | Per CI run that touches `apps/mobile/**` | Path filter caps it; expected < $5/mo at current cadence. |
| Sentry RN seat / quota | Existing plan absorbs it | At slice 9 | No incremental cost expected. |

## 13. Open questions

| # | Question | Owner | Answer by slice |
|---|----------|-------|----------------|
| 1 | Is the iPhone version primarily for the author, or for the small invited-user set (ADR 029)? If the latter, Expo Go is not viable for them and EAS / App Store becomes mandatory earlier. | Matt | Before slice 6 — drives the auth-callback redirect strategy |
| 2 | Is Android on the roadmap eventually? If yes, the Expo investment pays off twice; if no, future Swift migration becomes more attractive. | Matt | Before slice 5 — drives whether we keep RN universal idioms |
| 3 | Are iOS-specific features (Widgets, Live Activities, Watch, Apple Pay) desired in any horizon? If yes, plan a Swift migration timeline. | Matt | Before this epic closes — informs the next-epic backlog |
| 4 | Will we fund the Apple Developer Program in the next ~12 months? | Matt | Before slice 8 — drives whether EAS Build is part of slice 9 |
| 5 | Should the mobile chat (`/api/trips/[id]/chat`) be in scope eventually? If yes, the slice 1 conventions must include streaming. | Matt | Before slice 1 ADR is drafted |

## 14. Parking lot

Distinct from non-goals — these are ideas that could become future epics
once this one lands.

- PWA (Option A from ADR 045) — installable web shell with offline cache;
  one-week parallel project.
- AI streaming on mobile — RN consumption of the existing
  `/api/trips/[id]/chat` SSE / streaming endpoint, including `fetch`
  polyfill caveats and cancellation.
- Map and chart libraries for mobile — Recharts and Leaflet don't work in
  RN; Victory Native and `react-native-maps` are the likely answers, one
  ADR each.
- Universal Links + custom URL scheme — required for the PKCE redirect.
  Already implicitly part of slice 3 / 6; a deeper deep-link strategy
  becomes its own work later.
- Offline mode and conflict resolution for spend entries — its own design
  pass.
- Swift / SwiftUI rewrite — the REST API survives the UI swap because it
  is plain REST; remains the right answer if iOS becomes the primary
  surface.

## 15. Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| PKCE callback latency exceeds Vercel cold-start budget | Low | High — kills slice 3 | Kill criterion in §9; falls back to PWA. |
| Expo Go fragility on real device (re-pairing after iOS updates) | Medium | Medium — slows daily use | Kill criterion in §9; falls back to PWA or funded EAS. |
| Route Handler boilerplate balloons past ~20 lines × ~10 endpoints | Medium | Medium — invites scope creep | ADR to consider ts-rest / tRPC once measurable, per §10. |
| Google OAuth client config mismatch between web and mobile | Medium | Low — fixable per environment | Use separate iOS-scoped client; document in slice 3 SPEC. |
| Refresh-token reuse-detection logic has a subtle bug → users get logged out spuriously | Medium | High — UX regression | Integration tests in slice 3 explicitly cover rotation + reuse scenarios. |
| `packages/shared/` import paths break drizzle migrations or tests | Low | Medium — slows CI | Slice 4 keeps the package import-only, no runtime side-effects. |
| Apple changes Expo Go availability or unsigned-bundle rules | Low | High — entire distribution channel evaporates | Kill criterion in §9; PWA fallback exists. |

## 16. ADR triggers

Likely ADRs, written when each slice begins. ADR numbers are claimed at
write time, not pre-allocated.

| Slice | Likely ADR(s) | Notes |
|-------|---------------|-------|
| 1 | REST API conventions — versioning prefix, error envelope, `Result<T, E>` → HTTP mapping, naming, pagination | Sets the rules every later API slice inherits |
| 2 | Mobile authentication model — PKCE + JWT access tokens + rotating refresh tokens + Keychain + reuse detection | Settles the auth model before the endpoints land |
| 5 | Expo as the React Native framework and distribution path — Expo Go for dev, EAS Build deferred | Records the framework choice and the no-App-Store stance |
| 8 | Mobile testing strategy — Jest + RNTL + msw/native + Maestro + path-filtered CI | Records the test runner split (Jest mobile / Vitest web) |
| 9 | Mobile observability — Sentry RN + source maps via EAS | Records the same-vendor / same-project choice |

Deferred ADRs (post-epic, captured here so they're not lost): API client
strategy (plain `fetch` vs ts-rest vs tRPC), push notifications,
offline strategy, deep-link strategy, App Store submission and signing,
mobile chart library, mobile map library, PWA decision.

## 17. References

- [ADR 045 — iOS App Strategy](../decisions/045-ios-app-strategy.md)
- [ADR 046 — Monorepo Layout: apps/ and packages/](../decisions/046-monorepo-layout.md) (slice 0)
- [ADR 028 — Composition Root DI](../decisions/028-composition-root-di-container-for-runtime-dependencies.md)
- [ADR 029 — Closed auth with admin pre-provisioned membership](../decisions/029-closed-auth-invite-only-membership.md)
- [ADR 007 — Mobile-first responsive design](../decisions/007-mobile-first-accessibility.md)
- [ADR 012 — Integration test naming](../decisions/012-integration-test-naming-convention.md)
- [Building APIs with Next.js (Vercel, Feb 2025)](https://nextjs.org/blog/building-apis-with-nextjs)
- [Server Actions config reference (Next.js docs)](https://nextjs.org/docs/app/api-reference/config/next-config-js/serverActions)

---

## Slice ledger (append-only)

| Date | Slice # | SPEC | Status change | Notes |
|------|---------|------|---------------|-------|
| 2026-05-16 | 0 | n/a | Shipped | Monorepo restructure landed via ADR 046 before this epic was formalised. |
| 2026-05-20 | — | — | Epic drafted | Replaces `docs/ios-app-planning.md`. Awaiting human approval. |

## Epic-level deviations

| # | Deviation | Reason | Impact on other slices | Resolved? |
|---|-----------|--------|------------------------|-----------|

## Post-epic notes

_To be written when the epic closes._
