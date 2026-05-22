# Draft Brief — Mobile Authenticated "Me" Screen + Sign-Out (slice 7 of EPIC-001)

**Status:** Brief (pre-spec)
**Will become:** SPEC-007

## Idea (one paragraph)

Slice 7 ships the milestone screen of EPIC-001: after a signed-in user
launches the mobile app, the home screen shows "Hello, {name}" with
their email below and a working "Sign out" affordance. Achieving that
requires the auth machinery slice 6 deliberately left open — cold-start
Keychain read, proactive refresh-on-expired, single-flight refresh under
concurrency, a React Context for global auth state, and a new
server-side `POST /api/v1/auth/mobile/revoke` endpoint so sign-out
invalidates the refresh chain server-side. The me screen's content is
intentionally minimal (greeting + email + sign-out + a defensive
"pending approval" banner); no branding, no avatar, no offline mode.
With slice 7 done, EPIC-001 hits its definition-of-done.

## Refined scope

- **In scope:**
  - New `POST /api/v1/auth/mobile/revoke` endpoint + use case
    + integration tests + new wire shape in `@travel-planner/shared`.
  - Mobile auth state machine: `apps/mobile/src/auth/auth-context.tsx`
    (React Context, 3 states: `unknown | signed_out | signed_in`).
  - Mobile cold-start: `expo-splash-screen` held until the auth check
    resolves; redirector routes to `(auth)/sign-in` or `(app)/` via
    the canonical Expo Router auth-guard pattern.
  - `apps/mobile/src/auth/get-access-token.ts` — proactive refresh with
    60s buffer + single-flight mutex. Becomes the gateway for all
    authenticated `/api/v1/*` calls.
  - `apps/mobile/src/auth/keychain.ts` gains `readTokens()`.
  - `apps/mobile/src/auth/sign-in-flow.ts` reshape: stops calling `/me`,
    stops persisting tokens. Returns just `{ status: 'success'; tokens }`.
    All persistence + `/me` calls move to `AuthProvider.signIn(tokens)`.
  - Route restructure to `app/(auth)/sign-in.tsx` +
    `app/(app)/index.tsx` (me screen) + nested layouts.
  - Me screen with greeting + email + sign-out + defensive approval
    banner. No avatar; no custom branding.

- **Out of scope (deliberately):**
  - Custom branding (palette, font, icon, splash imagery) — defer to
    a dedicated polish SPEC after EPIC-001 closes.
  - Offline / cached-`/me` rendering — EPIC §6 non-goal.
  - "Boot error" UI for transient `/me` failures. All cold-start `/me`
    failures collapse to `signed_out` (decided as Q8 — the audience
    accepts the trade-off).
  - `/me` re-fetch on app foreground / window focus. Slice 7 calls
    `/me` once on cold-start + once on sign-in; that's it.
  - Mid-session refresh tests beyond the `get-access-token` unit
    tests. Slice 8+ exercises mid-session refresh via real
    concurrent calls.
  - `expo-auth-session` migration (TD-004 stays open).
  - Sentry RN — slice 9.
  - Universal Links.
  - New Maestro flow for the me screen (cannot drive the screen
    without bypassing slice 6's Google-OAuth barrier).

- **Out of scope (deferred):**
  - `me-screen.yaml` Maestro flow — needs Keychain-seedable test build
    (EPIC-002 era when ADP is funded).
  - "Switch account" UI on sign-out — current implementation just
    returns to sign-in; multi-account stays for later.

## Acceptance signal

End-to-end: launch the app on the author's iPhone via Expo Go after
having previously signed in. The native splash holds, then the home
screen renders "Hello, Matt" with the author's email below and a
"Sign out" button. Tap sign-out → returns to sign-in screen → tokens
gone from Keychain → server-side refresh chain revoked.

## Alternatives considered and rejected

| Option | Why rejected |
|--------|--------------|
| Local-only sign-out (no server revoke) | Q1. Leaves the refresh token valid for 30d after sign-out. Schema already supports revocation (`refresh_tokens.revoked_at` + `revokeChain` repo method exist from SPEC-004); endpoint is ~½ day of work. Durable-bias rule applies. |
| Index-as-redirector without route groups (Option A in Q2) | Q2. User chose route groups for the cleaner long-term semantics. Slightly more file restructure now, less restructure later when EPIC-002 adds more authenticated screens. |
| Layout-level effect routing (Option B in Q2) | Q2. Flash-of-sign-in risk; less idiomatic for Expo Router's auth pattern. |
| Reactive refresh (retry on 401) | Q3. Forces the same single-flight mutex anyway to avoid the reuse-detection race; adds no real value and one extra footgun class. |
| Zustand / module-level store for auth state | Q4. Three consumers don't need fine-grained subscriptions; React Context is the React-stdlib option and matches the durable-bias directive. |
| Avatar on me screen | Q5. Requires extending `/me` response with `image`, plumbing it through next-auth adapter, image-loading states. Slice budget creep for "Hello, Matt." Future profile slice can add it. |
| Local-part-stripping name fallback ("Hello, mattcarr") | Q5. Feels like guessing. Generic "Hello!" + email-below is more honest. |
| New `me-screen.yaml` Maestro flow | Q6. The screen lives behind slice 6's Google-OAuth barrier; can't be driven. Adding the YAML would just re-assert what `launch.yaml` already does. |
| Keep `/me` in `sign-in-flow.ts` (Option A in Q7) | Q7. Two `/me` call sites (cold-start + post-sign-in) is a divergence risk. AuthProvider as single owner is cleaner. |
| Boot-error state distinguishing transient vs definite `/me` failures (Option B in Q8) | Q8. User chose simplicity — accept that a wifi blip during cold-start forces re-OAuth. Smaller state machine, fewer tests. |
| Cached `MeResponse` for offline render (Option C in Q8) | Q8. Offline mode is an explicit EPIC §6 non-goal. |
| Introduce app palette / custom font / icon in slice 7 | Q9. Milestone bar is functional, not visual. Branding is a designer call wanting its own context. Defer. |

## Open risks

- **`expo-splash-screen` API stability across SDK 54.** The
  `preventAutoHideAsync` / `hideAsync` pair is the documented
  pattern but has had timing quirks historically (splash hidden
  before first frame). Mitigation: call `hideAsync()` inside the
  AuthProvider state-transition effect, not in a `useEffect` race
  with the redirector mount.
- **`useSegments()` + `useRouter()` race during the very first
  render.** If the guard effect fires before the segments are
  populated, the redirect target is ambiguous. Mitigation: gate the
  guard's redirect on `state.status !== 'unknown'`. While the auth
  check is in flight, no navigation happens.
- **Single-flight mutex correctness under React Strict Mode
  double-invocation.** Strict mode in dev double-mounts effects.
  The module-level promise must be idempotent — if the in-flight
  promise is reused, both mounts get the same result. Test
  explicitly for concurrent `getAccessToken()` calls.
- **`/revoke` endpoint and idempotency.** Re-calling revoke with
  an already-revoked refresh token should be a 2xx no-op, not a 4xx,
  because the client-side fire-and-forget pattern means we don't
  want to surface "already revoked" as an error UX. Bake idempotency
  into the use case.
- **Slice-6 code reshape.** Moving `/me` out of `sign-in-flow.ts`
  invalidates two slice-6 test cases (the /me-as-proof success and
  failure branches). Document the reshape in SPEC-007's "what
  changes from slice 6" so the diff isn't surprising at review.
- **`launch.yaml` Maestro flow.** The cold-start redirector means
  the root testID visible at launch is `login-screen-root` (because
  CI sim has no Keychain). The flow update from SPEC-006 already
  asserts this. Re-check after the route-group restructure.
- **Route-group restructure.** Moving files into `(auth)/` and
  `(app)/` directories means git history fragments. Plan to use
  `git mv` to preserve renames.

## Key answers from grilling

> **Q1 — Sign-out semantics?**
> Server-side revoke endpoint. Schema already supports it
> (`refresh_tokens.revoked_at` + `revokeChain` repo method exist);
> just need the endpoint + use case + wire shape. Client calls
> fire-and-forget. "Do the more secure option."

> **Q2 — Cold-start flow + routing structure?**
> Option C — Expo Router route groups `(auth)` / `(app)`. Splash
> held until the auth check resolves. Me screen at `(app)/index.tsx`.

> **Q3 — Proactive vs reactive refresh?**
> Proactive with 60s buffer, single-flight via module-level promise
> mutex. Reactive needs the same mutex anyway and adds the
> reuse-detection race footgun on top.

> **Q4 — Global auth state mechanism?**
> React Context. Three consumers don't need fine-grained
> subscriptions; React stdlib over a new dep matches the
> durable-bias directive.

> **Q5 — Me screen content + name fallback?**
> Greeting + email + sign-out + defensive approval banner.
> Name-fallback: "Hello!" generic + email always visible below.
> No avatar.

> **Q6 — Test coverage matrix?**
> Unit-heavy (Jest + RNTL): get-access-token, auth-context, me
> screen, sign-in screen, redirector. Web integration: /revoke
> endpoint. Web unit: revoke use case. No new Maestro flow.
> 4 manual on-device dry-runs.

> **Q7 — Where does `/me` live?**
> AuthProvider owns all `/me` calls. sign-in-flow becomes pure:
> PKCE + exchange + return tokens. AuthProvider's `signIn(tokens)`
> does the persistence + `/me` + state transition. Mild ordering
> change from slice 6 (writes-then-verifies vs verifies-then-writes)
> but same end state on failure.

> **Q8 — Cold-start `/me` failure mode?**
> Option A — all failures collapse to signed_out + clear Keychain.
> Three-state machine, no `boot_error`. Audience accepts a wifi
> blip forcing re-OAuth.

> **Q9 — Branding / visual polish?**
> Minimal. Stay on Expo neutral palette + system fonts. Defer
> branding to a future polish SPEC. Milestone bar is functional,
> not visual.
