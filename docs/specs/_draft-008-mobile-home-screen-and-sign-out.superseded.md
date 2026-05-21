# Draft Brief — Mobile Home Screen + Sign-Out (EPIC-001 slice 7, the milestone)

**Status:** Brief (pre-spec)
**Will become:** SPEC-008
**Parent epic:** [EPIC-001 — iOS App](../epics/EPIC-001-ios-app.md) — slice 7
**Author:** Matt Carr (with Claude Opus 4.7 via `plan-feature` + `grill-me`)
**Date:** 2026-05-21

---

## Idea (one paragraph)

Ship the milestone slice that closes EPIC-001's definition-of-done. After
slice 6 lands tokens in Keychain and parks the user on a placeholder
`/signed-in` screen, slice 7 (a) makes the app remember you are signed
in across launches (cold-start re-hydration with lazy refresh), (b)
replaces the placeholder with a real `/home` screen rendering "Hello,
{name ?? email}" from `GET /api/v1/me`, and (c) ships the sign-out
affordance that wipes Keychain and returns to the sign-in screen. The
slice also exercises `POST /api/v1/auth/mobile/refresh` for the first
time (mobile-side; the endpoint already exists from SPEC-004) so the
30-day rotating-refresh-token chain is no longer theoretical. To avoid
this milestone slice resting on a manual checklist, slice 7 pays in
once-and-for-all: a CI stub-fixture-server enables Maestro to drive
the full home + sign-out journey end-to-end without involving Google.

## Refined scope

### In scope

- New `AuthProvider` + `useAuth()` hook in `apps/mobile/src/auth/` with a
  4-variant state union: `loading | cold_start_error | signed_out |
  signed_in { accessToken, refreshToken, accessExpiresAt }`.
- Layout-level `RouteGuard` in `apps/mobile/app/_layout.tsx` that renders
  `<SplashView />` / `<ColdStartErrorView />` / `<Stack />` depending on
  `auth.status`.
- Cold-start sequence: `readTokens()` from Keychain → if missing →
  `signed_out`; if present + `access_expires_at` ≥ now + 60s leeway →
  `signed_in`; if expired/near-expired → call `/api/v1/auth/mobile/refresh`
  → on success rotate tokens (Keychain + memory) → `signed_in`; on
  `invalid_refresh_token` → wipe Keychain → `signed_out`; on network/5xx →
  keep tokens, transition to `cold_start_error` with a Retry button.
- New `app/home.tsx` (rename of `app/signed-in.tsx`, with rewrite):
  centered "Hello, {name ?? email}" + sign-out button. Fetches `/me` on
  mount via `auth.accessToken`. On any /me failure → single full-screen
  error UX with [Retry] + [Sign out].
- Sign-out flow: `auth.signOut()` calls `clearTokens()` + transitions
  state to `signed_out`. `home.tsx`'s sign-out handler then
  `router.replace('/')`.
- `app/signed-in.tsx` deleted. `runSignInFlow`'s success result evolves
  to include `tokens` (not just `email`); `app/index.tsx` calls
  `auth.signedIn(tokens)` + `router.replace('/home')` on success
  instead of passing the email as a route param.
- New pure helper `apps/mobile/src/auth/expiry.ts` exporting
  `isAccessExpired(expiresAt, now, leewaySeconds)`.
- New orchestrator `apps/mobile/src/auth/refresh-flow.ts` exporting
  `runRefreshFlow(refreshToken, deps)` mirroring `sign-in-flow.ts`'s
  shape.
- Keychain wrapper gains `readTokens(): Promise<MobileAuthExchangeResponse | null>`
  (slice 6 deliberately deferred this; slice 7 introduces it).
- Maestro `launch.yaml` updated to expect splash-then-sign-in transition.
- **NEW infrastructure**: `tests/e2e/mobile/fixture-server.ts` — a small
  Node HTTP sidecar booted by the CI `mobile-e2e` job that responds to
  the four `/api/v1/auth/mobile/*` endpoints + `/api/v1/me` with canned
  responses validated by `@travel-planner/shared` schemas. The mobile
  build is pointed at it via `EXPO_PUBLIC_API_BASE_URL` at simulator-install
  time, so the real production mobile code paths are exercised against
  a stub backend.
- Two new Maestro flows driven against the stub: `.maestro/flows/home.yaml`
  (sign-in → home renders with name) + `.maestro/flows/sign-out.yaml`
  (continuation: tap sign-out → sign-in returns).
- **[ADR-057](../decisions/057-mobile-e2e-stub-fixture-server.md)** new —
  Mobile e2e stub fixture server. Records the pattern for reuse across
  future mobile slices.
- **ADR-051 §6 amendment** in-place — cold-start re-hydration policy.
- `apps/mobile/AGENTS.md` gains a "Mobile auth state" section
  documenting the `useAuth()` shape, state machine, and cold-start
  algorithm.
- **TD-009** filed — server-side `/api/v1/auth/mobile/revoke` endpoint
  deferred (trigger: session-management UX, ≈ EPIC-003+).

### Out of scope (deliberately)

- `/api/v1/auth/mobile/revoke` server endpoint (filed as TD-009; trigger:
  session-management or "log out everywhere" UX).
- Auto-refresh on `/me` 401 (slice 7 routes any /me failure to the
  single error UX with Retry + Sign out; the 60s cold-start leeway
  catches the dominant skew case).
- Profile picture / avatar / additional /me fields (out of scope per
  EPIC-001 §6).
- `isApproved=false` gating on home (admin-de-approval-while-signed-in
  is a future-spec UX; the audience-of-two doesn't have admin actions
  yet).
- Test-mode code in the production mobile bundle (no `__DEV__`-gated
  deep links, no debug menus — the e2e coverage comes from the stub
  fixture server, not from mobile-app test affordances).
- Background-refresh while app is foregrounded for >15min (the access
  token expires; next /me call returns the generic error UX; user can
  tap Retry — Slice 9-ish ergonomic improvement).
- App lifecycle integration (AppState listener for refresh on foreground,
  etc.).
- Sentry mobile observability (slice 9).
- A "log out everywhere" affordance (waits for TD-009 trigger).

### Out of scope (deferred to a successor spec)

- Auto-refresh of access token on 401 from any authenticated endpoint
  (slice 8+ when there are 5+ authenticated calls justifying the
  abstraction).
- Background app refresh / refresh-on-foreground (when app lifecycle
  considerations land).
- Mobile Sentry integration (EPIC-001 slice 9).
- Server-side refresh-token revocation endpoint (TD-009).

## Acceptance signal

The slice is done when:

1. From a freshly cloned repo, the author's iPhone via Expo Go shows the
   sign-in screen, signs in with Google, and lands on a home screen
   showing "Hello, {name}".
2. Force-quitting and reopening the app shows the home screen again
   (cold-start happy path, access token still valid).
3. Letting the access token expire (15min+) then reopening shows the
   home screen again (cold-start refresh path; refresh-token chain
   rotates).
4. Putting the iPhone in airplane mode then reopening shows the splash
   → cold-start error view with [Retry] + [Sign out].
5. Tapping the home screen's sign-out button wipes Keychain and returns
   to the sign-in screen.
6. Maestro flows `launch.yaml`, `sign-in.yaml`, `home.yaml`, and
   `sign-out.yaml` all run green in CI against the stub fixture server.
7. `pnpm lint && pnpm db:check:migrations && pnpm type-check &&
   pnpm test:unit && pnpm test:integration && pnpm build && pnpm
   test:e2e:web && pnpm test:e2e:mobile` all exit 0.
8. EPIC-001's definition-of-done line "The home screen shows the
   authenticated user's name (the milestone slice)" is checked off.

## Alternatives considered and rejected

| # | Decision area | Option | Why rejected |
|---|---------------|--------|--------------|
| 1 | Cold-start UX | B (optimistic sign-in screen → flip to home) | Wrong-screen flash on the cold-start-with-tokens path; janky milestone UX. |
| 1 | Cold-start UX | C (optimistic home screen → flip to sign-in) | Same wrong-screen flash, on the other branch. |
| 1 | Cold-start UX | D (no cold-start at all; always show sign-in) | Anti-durable; EPIC §4 demo line 6 ("home shows Hello, Matt") would be brittle, forcing re-sign-in every launch. |
| 2 | State management primitive | B (module-scoped store + `<Redirect />` guards) | Duplicates `useContext`; can't easily suspend route rendering for the splash. |
| 2 | State management primitive | C (Zustand / jotai / valtio) | New vendor decision (its own ADR trigger) for a 4-state machine; YAGNI. |
| 3 | Cold-start algorithm | B (always /me first; refresh-and-retry on 401) | Two HTTP calls on every cold start; the home /me already verifies the bearer. |
| 3 | Cold-start algorithm | C (always /refresh, never check expiry) | Burns the refresh chain on every launch; amplifies reuse-detection false-positive blast radius. |
| 4 | Sign-out semantics | B (add `/api/v1/auth/mobile/revoke` in this slice) | Pushes slice past budget (server-side spec work + new wire shape); marginal defence given Keychain compromise = independent /refresh access. |
| 4 | Sign-out semantics | A (pure client wipe with no paper trail) | Loses the explicit "we know this gap exists" signal; C (= A with TD-009 entry) keeps the same code with the paper trail. |
| 5 | Route shape | B (keep `signed-in.tsx`, rewrite contents) | Route name lies about its purpose. |
| 5 | Route shape | C (add `home.tsx`, delete `signed-in.tsx` non-rename) | Loses git rename continuity for blame. |
| 6 | Sign-in flow contract | B (inject `onSignedIn` callback as dep) | Inverts data flow inside a pure orchestrator. |
| 6 | Sign-in flow contract | C (hoist orchestrator into AuthContext) | Bigger refactor than slice 7 needs; nothing in slice 7/8 wants `auth.startSignIn()` as the public API. |
| 6 | Sign-in flow contract | D (leave flow alone; re-read Keychain after) | Keeps the storeTokens duplication; creates Keychain-as-source-of-truth-vs-memory tension. |
| 7 | Home content | B (Hello + email below) | Pre-empts future spec scope without driver. |
| 7 | Home content | C (avatar + profile card + isApproved badge) | Requires /me schema changes (no avatar field today); out of scope per EPIC §6. |
| 7 | Home content | D (just the name, no "Hello" prefix) | Loses the warmth EPIC §4 demo line 6 implies. |
| 8 | /me failure UX | B (silent /refresh + retry on 401) | New rotation surface outside cold-start; complexity for a rare failure mode. |
| 8 | /me failure UX | C (any /me failure → wipe + sign out) | Wifi blip = sign-out; hostile UX. |
| 8 | /me failure UX | D (inline error on home shell) | Renders "home" with no real data; muddled. |
| 9 | E2E coverage | A-alone (rely on manual on-device checks) | Milestone slice's "done" should not depend on the author re-running manual checks every time. |
| 9 | E2E coverage | D-original (drive real Google OAuth) | Not feasible — Google rejects scripted creds by design. |
| 9 | E2E coverage | D-i (`__DEV__`-gated test deep link) | Test-only code path in production bundle; doctrinal footgun. |
| 9 | E2E coverage | D-ii (server-side `TEST_MODE` in web app) | Test mode in production paths; bigger budget hit; cross-app coupling. |
| 10 | AuthContext shape | B (`getValidAccessToken(): Promise<string \| null>`) | Over-engineering for one consumer; lazy-refresh-on-every-call patterns accrete queue + dedupe complexity. |
| 10 | AuthContext shape | C (api/client.ts reads bearer from context) | Inverts dep direction (api/client → auth); makes api helpers no longer pure. |
| 11 | Splash + gate placement | B (single index route morphs) | Scatters auth-state discrimination across every future route. |
| 11 | Splash + gate placement | C (separate `_splash.tsx` route) | Invents a route for a non-navigable state. |
| 12 | ADR triggers | "Write a standalone ADR-058 for cold-start policy" | Cold-start sits naturally inside ADR-051's mobile auth model; amend in place. |

## Open risks

- **Stub fixture server in CI is first-of-kind.** Similar risk class to
  SPEC-006's "EAS Local in CI" first-of-kind risk. Mitigation: keep
  `mobile-e2e` job at `continue-on-error: true` for week 1, same as
  SPEC-006's stance. Promote to blocking after the calendar-gated review.
- **`expo-router` v5 + SDK 54 `<Stack.Protected />` API availability.**
  Unknown whether the recommended Q11/A pattern fits Expo Router's
  available primitives at SDK 54. May need to fall back to per-route
  `<Redirect />` discrimination. Mitigation: implementation step 4 can
  pivot to per-route `<Redirect />` without changing the SPEC's design
  intent. Capture as deviation if it lands.
- **Token rotation during cold-start lazy refresh + concurrent sign-in
  is theoretically possible.** A user could background the app mid-refresh,
  re-foreground triggering another cold start, and have two refreshes
  race. Mitigation: refresh-flow.ts deduplication via a module-scoped
  Promise (only one inflight refresh at a time). Tests cover the race.
- **iOS Simulator Keychain in CI may not persist across simulator boots.**
  The stub-fixture-server-driven Maestro flows write to Keychain; if
  the simulator is torn down between flows, the next flow sees an empty
  Keychain. Mitigation: each Maestro flow is self-contained (each runs
  sign-in then asserts); no cross-flow Keychain state needed.
- **Budget bump 1–2d → 2–3d.** Logged as epic-level deviation #4 in
  EPIC-001 §16 at slice-7 close-out.

## Key answers from grilling

> Brief Q→A pairs capturing the most load-bearing decisions.

- **Q1 — Cold-start UX shape?** Splash/loading gate that resolves to
  home or sign-in. No wrong-screen flash.
- **Q2 — State management primitive?** Plain React Context + custom
  `useAuth()` hook. No third-party state library.
- **Q3 — Cold-start algorithm?** Lazy refresh keyed on
  `access_expires_at` with **60s leeway**. /me as verification step is
  not duplicated at cold-start; the home screen's normal /me fetch is
  the proof.
- **Q4 — Sign-out semantics?** Pure client-side wipe. Server-side
  /revoke is **TD-009** with trigger "session-management UX, ≈
  EPIC-003+".
- **Q5 — Route shape?** Rename `signed-in.tsx` → `home.tsx`, drop the
  `?email=` route param (home owns its own /me fetch).
- **Q6 — Sign-in flow contract change?** Flow returns tokens; AuthContext
  owns Keychain writes + in-memory state. Single owner invariant.
- **Q7 — Home content?** "Hello, {name ?? email}" + sign-out button.
  No isApproved gate. No avatar.
- **Q8 — /me failure UX?** Single full-screen error: [Retry] + [Sign out].
  No 401-aware refresh logic.
- **Q9 — Test plan distribution?** **A + D-iii**: full Jest coverage,
  Maestro stub-fixture-server flows for home + sign-out. No manual
  checks gating the slice's "done."
- **Q10 — AuthContext shape?** `useAuth()` returns the state union +
  raw `accessToken` (when signed_in). No `getValidAccessToken()`
  abstraction yet.
- **Q11 — Splash + gate placement?** Layout-level `RouteGuard` in
  `app/_layout.tsx`. Splash + cold-start-error views live in `src/auth/`
  (not in `app/`, per ADR 053).
- **Q12 — ADR triggers?** **ADR-057** new (stub fixture server pattern).
  **ADR-051 §6 amendment** in-place (cold-start re-hydration policy).
  AGENTS.md update. TD-009 filed.
- **Q13 — Implementation order?** 14 steps over ~3 days, tests-first.
