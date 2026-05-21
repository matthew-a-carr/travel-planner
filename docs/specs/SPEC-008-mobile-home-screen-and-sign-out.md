# SPEC-008: Mobile Home Screen + Sign-Out (EPIC-001 Milestone Slice)

**Date:** 2026-05-21
**Status:** Draft
**Author:** Matt Carr (with Claude Opus 4.7 via `plan-feature` + `grill-me`)
**Approved by:** —
**Parent epic:** [EPIC-001 — iOS App](../epics/EPIC-001-ios-app.md) — slice 7 (milestone)

---

## 1. Summary

Close EPIC-001's definition-of-done. After SPEC-006 lands tokens in
Keychain and parks the user on a placeholder `/signed-in` screen, slice
7 makes the app remember you are signed in across launches (cold-start
re-hydration with lazy refresh keyed on `access_expires_at` + 60s
leeway), replaces the placeholder with a real `/home` screen rendering
"Hello, {name ?? email}" from `GET /api/v1/me`, and ships the sign-out
affordance that wipes Keychain and returns to the sign-in screen. The
slice also exercises `POST /api/v1/auth/mobile/refresh` for the first
time on the mobile side, validating the rotating-refresh-token chain
end-to-end.

Auth state is centralised in a new `AuthProvider` + `useAuth()` hook
(plain React Context, no third-party state library); a layout-level
`RouteGuard` renders a splash view while the provider resolves
cold-start, then mounts the Stack once auth is `signed_out` or
`signed_in`. On network/5xx errors during cold-start refresh, the
provider transitions to a `cold_start_error` state with a Retry +
Sign-out affordance — not back to the sign-in screen — so a flaky wifi
connection isn't conflated with session expiry.

To prevent this milestone slice resting on a manual on-device checklist,
slice 7 ships a CI stub-fixture-server (ADR-057) that Maestro drives
the full sign-in → home → sign-out journey against, without involving
Google's IdP. End-to-end coverage of cold-start happy + sign-out lives
in CI alongside the existing slice-6 `launch.yaml` + `sign-in.yaml`
flows.

User-visible impact: the demo's lines 6–7 ("Hello, Matt" + Sign out)
work end-to-end on the author's iPhone via Expo Go. EPIC-001's
definition-of-done bullets all check off.

## 2. Motivation

EPIC-001 §7 slice 7 — the milestone slice. Demo script lines 6–7. Sits
on top of SPEC-006 (mobile sign-in + Keychain writes) and SPEC-004
(server-side `/api/v1/auth/mobile/{refresh, me}`). Budget 1–2d in the
EPIC; slice 7's grilling pass bumped it to 2–3d to absorb the Maestro
stub-fixture-server pay-in (Q9 / D-iii) — logged as epic-level
deviation #4.

Inherited from EPIC-001 §10 (not re-litigated):

- **Mobile framework**: Expo + Expo Router on SDK 54 (per ADR 053).
- **Mobile auth model**: PKCE → 15m HS256 access tokens + 30d opaque
  rotating refresh tokens with reuse detection. iOS Keychain via
  `expo-secure-store`. (ADR 051; this slice adds a new **§8 Cold-start
  re-hydration policy** in-place — §6 "Key rotation procedure" and §7
  "Future asymmetric signing" stay untouched.)
- **API transport**: plain Route Handlers; cookie OR bearer resolves to
  the same `User`.
- **Shared types**: `@travel-planner/shared` is the wire-shape source of
  truth (SPEC-005).
- **Mobile test runner**: Jest (`jest-expo` preset) + RNTL + fetch-spy.
- **Mobile E2E**: Maestro YAML, path-filtered macOS CI job per ADR 055.

The grilling session resolved the slice-altitude design questions; see
`docs/specs/_draft-008-mobile-home-screen-and-sign-out.md` (or its
`.superseded.md` after this SPEC is committed) for the full Q→A trail.
Load-bearing decisions:

- Splash/loading gate via layout-level `RouteGuard` (no wrong-screen flash).
- Plain React Context + `useAuth()` hook (no Zustand/jotai).
- Cold-start: lazy refresh keyed on `access_expires_at` + 60s leeway.
  Network/5xx → `cold_start_error` with Retry; `invalid_refresh_token`
  → wipe + signed_out.
- Pure client-side sign-out; server-side /revoke deferred as TD-009
  with trigger "session-management UX, ≈ EPIC-003+".
- Rename `signed-in.tsx` → `home.tsx`; drop the `?email=` route param.
- Sign-in flow returns tokens; AuthContext owns Keychain writes + state.
- Home: "Hello, {name ?? email}" + sign-out, no isApproved gate.
- Single full-screen /me error UX with [Retry] + [Sign out]; no
  401-aware refresh in this slice.
- E2E via CI stub-fixture-server (ADR-057); no test-only code in the
  production mobile bundle; no manual checks gating slice "done".
- `useAuth()` exposes raw `accessToken`; no `getValidAccessToken()`
  abstraction.

## 3. Acceptance criteria

1. Given a freshly cloned repo and a pre-approved Google account, when
   I `pnpm install && EXPO_PUBLIC_API_BASE_URL=http://<lan-ip>:3000
   pnpm dev:mobile` and scan the QR in Expo Go, then the splash view
   renders first (`splash-view-root` visible) and the sign-in screen
   (`login-screen-root`) renders once the AuthProvider resolves to
   `signed_out`. (Splash-visible-duration is a quality target — see
   §14 — not a binding acceptance gate.)
2. Given I am on the sign-in screen, when I complete the Google OAuth
   flow as a pre-approved user, then the app navigates to `/home` and
   the screen renders "Hello, {name ?? email}" with `testID="home-screen-greeting"`.
3. Given I have signed in successfully, when I force-quit the app and
   reopen it via Expo Go (with the access token still valid), then the
   splash shows briefly, no network call to `/refresh` is made, and the
   home screen renders directly.
4. Given I have signed in successfully and the access token has expired
   (more than 15 minutes since sign-in, OR `access_expires_at` is within
   60 seconds of now), when I reopen the app, then the splash shows
   briefly, the app calls `POST /api/v1/auth/mobile/refresh` with the
   stored refresh token, receives a fresh token triple, writes it to
   Keychain, and the home screen renders.
5. Given I have signed in successfully and the server returns
   `invalid_refresh_token` on the cold-start refresh attempt (refresh
   token expired or chain revoked), when I reopen the app, then
   Keychain is wiped and the sign-in screen renders.
6. Given I have signed in successfully and the network is unreachable
   when I reopen the app (airplane mode, no server reachable), and the
   access token requires a refresh per the 60s leeway check, then the
   cold-start error view renders (`testID="cold-start-error-root"`)
   with a Retry button (`testID="cold-start-error-retry"`) and a Sign
   out button (`testID="cold-start-error-sign-out"`). Tokens stay in
   Keychain.
7. Given I am on the cold-start-error view, when I tap Retry and the
   network is now reachable, then the refresh succeeds and the home
   screen renders. When I tap Sign out (still in cold-start-error
   state), then Keychain is wiped and the sign-in screen renders.
8. Given I am on the home screen, when I tap Sign out
   (`testID="home-screen-sign-out"`), then Keychain is wiped, the
   sign-in screen renders, and Xcode's device-window Keychain inspector
   shows no `travel_planner.*` entries.
9. Given the home screen is mounted, when `GET /api/v1/me` returns a
   non-2xx status or the network rejects, then the screen renders a
   full-screen error UX with a Retry button (`testID="home-screen-error-retry"`)
   and a Sign out button (`testID="home-screen-error-sign-out"`).
   Tapping Retry re-runs /me; tapping Sign out wipes Keychain + returns
   to sign-in.
10. Given the new component tests, when I run
    `pnpm --filter @travel-planner/mobile test`, then it covers — at
    minimum — `isAccessExpired` boundary cases, `readTokens` happy +
    missing + malformed, `runRefreshFlow`'s three branches, the
    `AuthProvider`'s five cold-start branches + three actions, the
    home screen's four UI branches, the `RouteGuard`'s three render
    branches, the splash + cold-start-error views, and the updated
    sign-in flow + sign-in screen.
11. Given the stub fixture server, when I run
    `pnpm test:e2e:mobile` locally (after booting the
    fixture server), then `launch.yaml`, `sign-in.yaml`, `home.yaml`,
    and `sign-out.yaml` all pass against the iOS Simulator.
12. Given a `apps/mobile/**` PR, when CI runs, then the `mobile-e2e`
    job boots the stub fixture server as a sidecar, sets
    `EXPO_PUBLIC_API_BASE_URL=http://localhost:<port>` for the mobile
    build, runs all four Maestro flows, and either passes or surfaces
    the Maestro report as a CI artifact. The job remains
    `continue-on-error: true` for week 1 from this SPEC's merge date,
    per ADR 055's calendar-gated promotion stance.
13. Given the full verification suite at SPEC close-out, then
    `pnpm lint && pnpm db:check:migrations && pnpm type-check &&
    pnpm test:unit && pnpm test:integration && pnpm build && pnpm
    test:e2e:web && pnpm test:e2e:mobile` all exit 0 from the repo
    root. Web-side tests stay green unchanged.

## 4. Demo script

1. On a freshly cloned repo, `pnpm install` then `pnpm dev` — web app
   serves at `http://localhost:3000` unchanged.
2. In another shell, look up the Mac's LAN IP, then run
   `EXPO_PUBLIC_API_BASE_URL=http://<lan-ip>:3000 pnpm dev:mobile`.
3. On the author's iPhone, open Expo Go and scan the QR. The bundle
   loads; a brief splash view (`splash-view-root`) renders for ~200ms,
   then the sign-in screen appears (no tokens in Keychain yet).
4. Tap **Sign in with Google**. Complete OAuth with the pre-approved
   author account. The flow lands tokens in Keychain via
   `auth.signedIn(tokens)`, navigates to `/home`, and the screen
   renders "Hello, Matt".
5. **Force-quit the app** (swipe up from app switcher). Reopen via
   Expo Go. The splash flashes briefly, then the home screen renders
   again without re-OAuth (cold-start happy path — access token is
   still within its 15-minute lifetime).
6. **Wait 15+ minutes** (or manually expire by setting the iPhone
   clock forward — optional dev affordance). Reopen the app. The
   splash holds for ~500ms while `/api/v1/auth/mobile/refresh` rotates
   the chain; the home screen then renders (cold-start refresh path).
   Xcode's Keychain inspector confirms the three values have rotated.
7. Enable iPhone airplane mode. Force-quit + reopen the app. The
   splash transitions to the cold-start error view ("We couldn't
   verify your session. Check your connection and try again.") with
   [Retry] + [Sign out]. Disable airplane mode, tap [Retry] — the
   home screen renders.
8. On the home screen, tap **Sign out** (`home-screen-sign-out`). The
   screen transitions back to the sign-in screen. Xcode's Keychain
   inspector confirms `travel_planner.access_token`,
   `travel_planner.refresh_token`, and
   `travel_planner.access_expires_at` are all gone.
9. Open a PR touching `apps/mobile/` and watch CI. The `mobile-e2e`
   job builds the dev-client (per ADR-055's pipeline), boots the stub
   fixture server (port-randomised), points the mobile build at it
   via `EXPO_PUBLIC_API_BASE_URL`, installs the build on the Simulator,
   and runs all four Maestro flows. Reports green.

## 5. Out of scope

Inherited from EPIC-001 §6 / §10:

- No App Store / TestFlight / EAS Build signed builds / APNs / Android.
- No tRPC / ts-rest / GraphQL.

Specific to this slice:

- **Server-side `/api/v1/auth/mobile/revoke` endpoint.** Filed as
  TD-009. Trigger: session-management or "log out everywhere" UX
  prioritised (≈ EPIC-003+). Sign-out in this slice is pure client-side
  Keychain wipe; the refresh token remains valid on the server until
  its 30-day natural expiry. Acceptable for the audience-of-two given
  the threat model (Keychain compromise = independent /refresh access
  anyway).
- **Auto-refresh on /me 401 from the home screen.** Slice 7 routes any
  /me failure to the single error UX (Retry + Sign out). The 60s
  cold-start leeway catches the dominant clock-skew case before /me
  runs.
- **Background-refresh while the app is foregrounded for >15min.**
  Access token expires; next /me call returns the generic error UX;
  user taps Retry. Slice 9-ish ergonomic improvement.
- **AppState listener / refresh-on-foreground / refresh-on-resume.**
  Same reason.
- **isApproved=false gating on the home screen.** Admin-de-approval-
  while-signed-in is a future-spec UX (probably a forced sign-out +
  "your access has been revoked" screen). Audience-of-two doesn't
  have admin actions today.
- **Profile picture / avatar / additional /me fields.** /me's response
  schema (id / email / name / isApproved) is unchanged.
- **Test-mode code in the production mobile bundle.** No
  `__DEV__`-gated deep links, no debug menus, no in-app token
  injection. The Maestro e2e coverage comes from the stub fixture
  server (ADR-057), not from mobile-app test affordances.
- **A "log out everywhere" affordance.** Waits for TD-009 trigger.
- **Mobile Sentry / observability.** Slice 9 / SPEC-009-or-later.
- **Universal Links / https-based deep links.** Custom scheme only,
  same as SPEC-006.
- **Replacing `expo-secure-store` with a different Keychain wrapper.**
- **EAS Build / dev-client signing improvements** beyond SPEC-006's
  ADR-055 baseline.

## 6. Prerequisites

- EPIC-001 slices 1–6 Done (SPEC-001, SPEC-002, SPEC-003, SPEC-004,
  SPEC-005, SPEC-006). ✅ All Done as of 2026-05-21.
- `apps/mobile/src/auth/{pkce,keychain,sign-in-flow}.ts` exist as
  delivered by SPEC-006. `keychain.ts`'s `readTokens` is intentionally
  not exported yet — slice 7 adds it.
- `apps/mobile/.maestro/flows/{launch,sign-in}.yaml` exist.
- The `mobile-e2e` GitHub Actions job exists at
  `continue-on-error: true` per SPEC-006 step 9 / ADR-055.
- `@travel-planner/shared` exports the wire shapes consumed by slice
  7: `mobileAuthRefreshRequestSchema`, `mobileAuthRefreshResponseSchema`,
  `meResponseSchema`, `apiErrorBodySchema`. ✅ Done.
- Author's iPhone has Expo Go installed with SDK 54 support. ✅ Done
  (SPEC-006 close-out validated).
- A pre-approved test user record in the database (for the on-device
  demo step 4): `pnpm auth:bootstrap-admin -- <author-email> "<name>"`
  on the dev environment. ✅ Already present from SPEC-006.
- No new env vars on the SERVER side. No new env vars on the CLIENT
  side either — `EXPO_PUBLIC_API_BASE_URL` from SPEC-006 still suffices.

## 7. Design

### Layer layout (additions)

`apps/mobile/src/auth/` grows. `apps/mobile/app/signed-in.tsx` is
deleted; `apps/mobile/app/home.tsx` takes its place.

```
apps/mobile/
├── app/
│   ├── _layout.tsx                   (modified: wraps in AuthProvider + RouteGuard)
│   ├── index.tsx                     (modified: calls auth.signedIn on success)
│   ├── home.tsx                      (new: replaces signed-in.tsx)
│   └── signed-in.tsx                 (DELETED)
├── src/
│   ├── auth/
│   │   ├── pkce.ts                   (unchanged)
│   │   ├── keychain.ts               (modified: + readTokens)
│   │   ├── sign-in-flow.ts           (modified: returns tokens, drops storeTokens dep)
│   │   ├── refresh-flow.ts           (new: runRefreshFlow)
│   │   ├── expiry.ts                 (new: isAccessExpired)
│   │   ├── auth-context.tsx          (new: AuthProvider + useAuth hook)
│   │   ├── route-guard.tsx           (new: layout-level discriminant)
│   │   ├── splash-view.tsx           (new: loading-state view)
│   │   └── cold-start-error-view.tsx (new: Retry + Sign-out view)
│   └── api/
│       └── client.ts                 (unchanged)
├── __tests__/
│   ├── app/
│   │   ├── index.test.tsx            (modified: mocks useAuth)
│   │   ├── home.test.tsx             (new: 4 branches)
│   │   └── signed-in.test.tsx        (DELETED)
│   ├── auth/
│   │   ├── pkce.test.ts              (unchanged)
│   │   ├── keychain.test.ts          (modified: + readTokens cases)
│   │   ├── sign-in-flow.test.ts      (modified: drops storeTokens assertion; adds tokens-in-result)
│   │   ├── refresh-flow.test.ts      (new: 3 branches)
│   │   ├── expiry.test.ts            (new: 4 boundary cases)
│   │   ├── auth-context.test.tsx     (new: 5 cold-start + 3 actions)
│   │   ├── route-guard.test.tsx      (new: 3 render branches)
│   │   ├── splash-view.test.tsx      (new)
│   │   └── cold-start-error-view.test.tsx (new: 2 button branches)
│   ├── api/client.test.ts            (unchanged)
│   └── shared.test.ts                (unchanged)
└── .maestro/flows/
    ├── launch.yaml                   (modified: expect splash → sign-in)
    ├── sign-in.yaml                  (unchanged)
    ├── home.yaml                     (new)
    └── sign-out.yaml                 (new)

tests/e2e/mobile/
└── fixture-server.ts                 (new: stub HTTP server for CI)
```

### Data & types (mobile side)

No domain changes. Three mobile-internal types are introduced:

```ts
// apps/mobile/src/auth/auth-context.tsx
type AuthState =
  | { status: 'loading' }
  | { status: 'cold_start_error' }
  | { status: 'signed_out' }
  | {
      status: 'signed_in';
      accessToken: string;
      refreshToken: string;
      accessExpiresAt: string; // ISO 8601 UTC; matches the wire shape
    };

type AuthApi = AuthState & {
  signedIn: (tokens: MobileAuthExchangeResponse) => Promise<void>;
  signOut: () => Promise<void>;
  retryColdStart: () => Promise<void>;
};

// apps/mobile/src/auth/refresh-flow.ts
type RefreshResult =
  | { status: 'success'; tokens: MobileAuthRefreshResponse }
  | { status: 'chain_revoked' }   // invalid_refresh_token → wipe + signed_out
  | { status: 'transient_failure' }; // network/5xx → cold_start_error
```

`MobileAuthExchangeResponse` and `MobileAuthRefreshResponse` come from
`@travel-planner/shared` (`mobileAuthExchangeResponseSchema` ≡
`mobileAuthRefreshResponseSchema` per the existing wire-shape design).

### Behaviour

**`apps/mobile/src/auth/expiry.ts`** — one pure function:

```ts
export function isAccessExpired(
  expiresAt: string,           // ISO 8601 UTC from Keychain
  now: Date,
  leewaySeconds: number,       // 60 in production, configurable for tests
): boolean {
  const expiresAtMs = Date.parse(expiresAt);
  if (Number.isNaN(expiresAtMs)) return true; // malformed → treat as expired
  return now.getTime() + leewaySeconds * 1000 >= expiresAtMs;
}
```

**`apps/mobile/src/auth/keychain.ts`** gains `readTokens`:

```ts
export async function readTokens(): Promise<MobileAuthExchangeResponse | null> {
  const [access_token, refresh_token, access_expires_at] = await Promise.all([
    SecureStore.getItemAsync(ACCESS_TOKEN_KEY),
    SecureStore.getItemAsync(REFRESH_TOKEN_KEY),
    SecureStore.getItemAsync(ACCESS_EXPIRES_AT_KEY),
  ]);
  if (
    access_token === null ||
    refresh_token === null ||
    access_expires_at === null
  ) {
    return null;
  }
  // Validate the shape via the shared schema; loud failure on garbage.
  const parsed = mobileAuthExchangeResponseSchema.safeParse({
    access_token,
    refresh_token,
    access_expires_at,
  });
  return parsed.success ? parsed.data : null;
}
```

**`apps/mobile/src/auth/refresh-flow.ts`** — refresh orchestrator
mirroring `sign-in-flow.ts`'s injected-deps shape:

```ts
export type RefreshDeps = {
  apiPost: typeof apiPost;
  storeTokens: typeof storeTokens;
  clearTokens: typeof clearTokens;
};

export async function runRefreshFlow(
  refreshToken: string,
  deps: RefreshDeps,
): Promise<RefreshResult> {
  const result = await deps.apiPost<MobileAuthRefreshResponse>(
    '/api/v1/auth/mobile/refresh',
    { refresh_token: refreshToken },
    mobileAuthRefreshResponseSchema,
  );
  if (result.ok) {
    await deps.storeTokens(result.data);
    return { status: 'success', tokens: result.data };
  }
  if (result.error.code === 'invalid_refresh_token') {
    await deps.clearTokens();
    return { status: 'chain_revoked' };
  }
  // Network failures, 5xx, rate_limited — keep tokens, surface to splash.
  return { status: 'transient_failure' };
}
```

Module-scoped dedupe (concurrent cold-start refresh + race-from-resume
safety):

```ts
let inflight: Promise<RefreshResult> | null = null;

export async function runRefreshFlowDedup(
  refreshToken: string,
  deps: RefreshDeps,
): Promise<RefreshResult> {
  if (inflight) return inflight;
  inflight = runRefreshFlow(refreshToken, deps).finally(() => {
    inflight = null;
  });
  return inflight;
}
```

**`apps/mobile/src/auth/auth-context.tsx`** — `AuthProvider` exposes the
4-state machine via `useAuth()`.

Cold-start sequence (in a single `useEffect(() => { ... }, [])` that
runs once on mount):

1. `const tokens = await readTokens()`. If null → `setState({ status: 'signed_out' })`. Done.
2. `if (!isAccessExpired(tokens.access_expires_at, new Date(), 60))` →
   `setState({ status: 'signed_in', ...tokens })`. Done.
3. `const result = await runRefreshFlowDedup(tokens.refresh_token, deps)`.
   - `success` → `setState({ status: 'signed_in', ...result.tokens })`.
   - `chain_revoked` → `setState({ status: 'signed_out' })`.
   - `transient_failure` → `setState({ status: 'cold_start_error' })`.

Actions:

- `signedIn(tokens)`: `await storeTokens(tokens); setState({ status: 'signed_in', ...tokens })`.
- `signOut()`: `await clearTokens(); setState({ status: 'signed_out' })`.
- `retryColdStart()`: resets state to `loading` + re-runs the cold-start
  sequence above. (Idempotent — safe to invoke repeatedly.)

The hook returns `{ ...state, signedIn, signOut, retryColdStart }`.

**`apps/mobile/src/auth/route-guard.tsx`** — layout-level discriminant:

```tsx
export function RouteGuard({ children }: { children: ReactNode }) {
  const auth = useAuth();
  if (auth.status === 'loading') return <SplashView />;
  if (auth.status === 'cold_start_error') return <ColdStartErrorView />;
  return <>{children}</>;
}
```

`children` is the `<Stack />` from `_layout.tsx`. The Stack contains
both `index` (sign-in) and `home` routes; the sign-in screen
explicitly calls `router.replace('/home')` after a successful
`auth.signedIn(tokens)`, and home explicitly calls `router.replace('/')`
after `auth.signOut()`.

**`apps/mobile/src/auth/splash-view.tsx`** — minimal loading view:

```tsx
export function SplashView() {
  return (
    <SafeAreaView
      style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}
      testID="splash-view-root"
    >
      <Text style={{ fontSize: 24, fontWeight: '600', marginBottom: 16 }}>
        Travel Planner
      </Text>
      <ActivityIndicator testID="splash-view-spinner" />
    </SafeAreaView>
  );
}
```

**`apps/mobile/src/auth/cold-start-error-view.tsx`** — Retry + Sign out:

```tsx
export function ColdStartErrorView() {
  const auth = useAuth();
  // ...
  return (
    <SafeAreaView ... testID="cold-start-error-root">
      <Text>We couldn't verify your session. Check your connection and try again.</Text>
      <Pressable onPress={() => auth.retryColdStart()} testID="cold-start-error-retry">
        <Text>Retry</Text>
      </Pressable>
      <Pressable onPress={() => auth.signOut()} testID="cold-start-error-sign-out">
        <Text>Sign out</Text>
      </Pressable>
    </SafeAreaView>
  );
}
```

(Sign-out from this state navigates via the RouteGuard naturally — the
Stack mounts when `auth.status` flips to `signed_out`; the Stack's
initial route is `index`.)

**`apps/mobile/app/home.tsx`** — the milestone screen. Local 3-state
discriminant for the /me fetch lifecycle:

```ts
type MeState =
  | { status: 'loading' }
  | { status: 'success'; me: MeResponse }
  | { status: 'error'; code: string };
```

Renders:

- `loading` → ActivityIndicator centred in a `home-screen-root` container.
- `success` → "Hello, {me.name ?? me.email}" centred + sign-out button below.
- `error` → centred error copy + [Retry] + [Sign out] buttons.

On mount: `apiGet('/api/v1/me', meResponseSchema, auth.accessToken)`.
Set state based on result.

Sign-out: `await auth.signOut(); router.replace('/')`.

**`apps/mobile/app/_layout.tsx`** — wrap in AuthProvider + RouteGuard:

```tsx
export default function RootLayout() {
  return (
    <AuthProvider>
      <RouteGuard>
        <Stack screenOptions={{ headerShown: false }} />
      </RouteGuard>
    </AuthProvider>
  );
}
```

**`apps/mobile/app/index.tsx`** sign-in screen — minor change:

```tsx
// On success branch of runSignInFlow:
await auth.signedIn(result.tokens);
router.replace('/home');
```

(Previously: `router.replace({ pathname: '/signed-in', params: { email: result.email } })`.)

### Storage & migrations

No DB migrations. No new Keychain keys (slice 6 already established the
three-key layout). `readTokens()` is the new read side of the existing
write helpers.

### External integrations

- **`POST /api/v1/auth/mobile/refresh`**: first time the mobile client
  calls this endpoint in production. The server-side already exists
  from SPEC-004 + ADR-051 §3; mobile-side calls go through
  `runRefreshFlow`. Wire shape: `{ refresh_token }` → `{ access_token,
  refresh_token, access_expires_at }`.
- **`GET /api/v1/me`**: same as SPEC-006's verification-step use; now
  the home screen owns its lifecycle.
- **No new packages.** `expo-web-browser`, `expo-crypto`,
  `expo-secure-store` (all SPEC-006) are sufficient.

### UI / UX

- **Splash view**: vertically centred "Travel Planner" + spinner. Solid
  neutral background. Minimum visible duration ~150ms even on instant
  resolves (a flash-of-nothing → home is worse UX than a brief splash).
  Implementation: use `requestAnimationFrame` + `setTimeout(150)` to
  ensure splash is rendered at least once before transitioning.
- **Cold-start error view**: centred copy + two stacked buttons
  ([Retry] primary, [Sign out] secondary). 44×44pt touch targets each
  per CONSTITUTION §8.
- **Home screen**: centred "Hello, {name ?? email}" in large type +
  centred [Sign out] button below.
- **Home /me error UX**: centred error copy + two stacked buttons
  ([Retry] primary, [Sign out] secondary), same shape as cold-start-error.
- testIDs (per `apps/mobile/AGENTS.md`'s `<screen>-<element>` convention):
  - `splash-view-root`, `splash-view-spinner`
  - `cold-start-error-root`, `cold-start-error-retry`, `cold-start-error-sign-out`
  - `home-screen-root`, `home-screen-greeting`, `home-screen-sign-out`
  - `home-screen-error-root`, `home-screen-error-retry`, `home-screen-error-sign-out`
- Responsive: single-column, mobile-only (web's three-viewport rule from
  ADR 007 doesn't apply to the RN app, per SPEC-006).

## 8. Security & data considerations

**Threats considered:**

- **Stale-bearer leakage on cold-start.** If the cold-start refresh
  succeeds, the old `access_token` is overwritten in Keychain by
  `storeTokens` inside `runRefreshFlow`. The old refresh token is also
  rotated (server-side reuse detection from ADR-051 ensures the old
  token is invalidated). Threat: a brief window between SecureStore
  setItemAsync(access) and setItemAsync(refresh) where Keychain
  contains the new access + old refresh. Mitigation:
  `storeTokens` already does `Promise.all` (writes are concurrent, not
  serialised). The intermediate state is at most ~10ms and is bounded
  by Keychain's own atomicity within a single `setItemAsync` call.
  Acceptable.
- **Bearer leakage via logs.** The provider's cold-start `console.warn`
  on errors only logs the error `code` from
  `runRefreshFlow`'s result envelope (`'chain_revoked'` or
  `'transient_failure'`) — never the token value, never the response
  body. Inherits SPEC-006's logging discipline.
- **Refresh token in memory during cold-start.** The provider holds the
  refresh token in `useState` for the duration of `signed_in`. JS
  engine cleanup is asynchronous; React state survives across renders.
  Mitigation: `auth.signOut()` clears state immediately on call, so
  post-sign-out the in-memory value is null. iOS process isolation
  ensures other apps can't read this memory.
- **Closed-auth bypass on cold-start.** The refresh endpoint rejects
  refresh tokens whose chain has been revoked (server-side per ADR
  029 / ADR-051). If an admin de-approves a user after sign-in but
  before the access token expires, the user gets a stale signed_in
  state until cold-start triggers a refresh (then chain_revoked →
  signed_out). Acceptable for the audience-of-two; admin-action UX is
  future-spec.
- **Race: concurrent cold-start refresh.** Theoretical if a user
  background-foregrounds the app mid-cold-start. Mitigation: module-
  scoped `inflight` Promise in `runRefreshFlowDedup` ensures at most
  one refresh call inflight at a time. Tests cover the race.
- **Keychain malformed shape.** If Keychain ever contains a triple that
  doesn't match `mobileAuthExchangeResponseSchema` (corruption,
  abandoned-write artefact), `readTokens` returns `null` → `signed_out`
  → user re-signs-in. No crash.
- **Stub fixture server (tests only).** Runs on `localhost` from
  GitHub Actions macOS runners; not network-reachable. Test-only;
  documented in ADR-057.

**Mitigations beyond the above:**

- All Keychain writes happen ONLY after a /me or /refresh round-trip
  succeeds — never on partial state.
- The `inflight` dedupe in `runRefreshFlowDedup` prevents stampede.
- `cold_start_error` keeps tokens in Keychain (Retry can re-attempt);
  only `chain_revoked` wipes them.

**Secrets needed:** none new. `EXPO_PUBLIC_API_BASE_URL` (SPEC-006)
remains the only client-side env var.

## 9. Test plan

Tests written **before** implementation per CONSTITUTION.md §3.

### E2E (Maestro)

| Test file | What it covers |
|---|---|
| `apps/mobile/.maestro/flows/launch.yaml` | **Modified.** App launches → `splash-view-root` appears briefly → `login-screen-root` renders once auth resolves to `signed_out`. Stub fixture server returns 200 on /api/v1/me only if hit (it isn't, since no tokens yet). |
| `apps/mobile/.maestro/flows/sign-in.yaml` | **Unchanged from SPEC-006.** Tap sign-in button → observable in-flight state. |
| `apps/mobile/.maestro/flows/home.yaml` | **New.** Launch → splash → sign-in screen → fixture server returns canned /start + /exchange + /me → home screen renders with `home-screen-greeting` containing the canned name. |
| `apps/mobile/.maestro/flows/sign-out.yaml` | **New.** Continuation of home.yaml: tap `home-screen-sign-out` → `login-screen-root` returns. |

### Integration (Vitest + Testcontainers, web side)

| Test file | What it covers |
|---|---|
| All SPEC-001/002/004/005 web-side `.int-test.ts` files | Stay green unchanged. Slice 7 is mobile-side; no web-side server changes. The `.parse()` drift guards from SPEC-005 continue to act as the wire-shape contract for both the real and stub-fixture-server cases. |

### Unit (Jest + RNTL + fetch-spy, mobile side)

| Test file | What it covers |
|---|---|
| `apps/mobile/__tests__/auth/expiry.test.ts` | **New.** 4 boundary cases for `isAccessExpired`: far future → false; past → true; at boundary → true (≥ comparison); within leeway → true; malformed ISO string → true (fail-closed). |
| `apps/mobile/__tests__/auth/keychain.test.ts` | **Modified.** Existing storeTokens + clearTokens tests stay. Add: readTokens returns triple when all present; returns null when any key missing; returns null when triple fails shared-schema validation. |
| `apps/mobile/__tests__/auth/refresh-flow.test.ts` | **New.** 3 branches: success (storeTokens called with response; returns `{ status: 'success', tokens }`); `invalid_refresh_token` (clearTokens called; returns `{ status: 'chain_revoked' }`); network failure / 5xx (no Keychain mutation; returns `{ status: 'transient_failure' }`). Plus dedupe test: two concurrent runRefreshFlowDedup calls share the underlying fetch invocation (fetch-spy assertion). |
| `apps/mobile/__tests__/auth/auth-context.test.tsx` | **New.** 5 cold-start branches via RNTL `renderHook` with mocked `readTokens` + `runRefreshFlow` + `clearTokens`: (a) no tokens → signed_out; (b) tokens + not expired → signed_in; (c) tokens + expired + refresh success → signed_in with new tokens; (d) tokens + expired + refresh chain_revoked → signed_out + Keychain wiped; (e) tokens + expired + refresh transient_failure → cold_start_error + tokens kept. Plus 3 action tests: signedIn (stores + transitions), signOut (clears + transitions), retryColdStart (re-runs cold-start logic). |
| `apps/mobile/__tests__/auth/route-guard.test.tsx` | **New.** 3 render branches: loading → SplashView mounted; cold_start_error → ColdStartErrorView mounted; signed_in/signed_out → children mounted (assertion via a test sentinel `<Text testID="children-sentinel" />`). |
| `apps/mobile/__tests__/auth/splash-view.test.tsx` | **New.** Renders title text + spinner; testIDs present. |
| `apps/mobile/__tests__/auth/cold-start-error-view.test.tsx` | **New.** Retry button calls `auth.retryColdStart()`; Sign-out button calls `auth.signOut()`. Both via mocked `useAuth`. |
| `apps/mobile/__tests__/auth/sign-in-flow.test.ts` | **Modified.** Drop the "storeTokens called once" assertion; add "success result includes tokens field equal to exchange response". Other branches (cancel / access_denied / generic error / /me failure → no persist) stay. Note: the /me-failure-no-persist test now asserts that the returned result has no `tokens` field (or null) — the orchestrator's "no partial state" invariant moves from a Keychain assertion to a return-value assertion. |
| `apps/mobile/__tests__/app/index.test.tsx` | **Modified.** Mocks `useAuth` + `runSignInFlow`. Asserts: on success, `auth.signedIn(tokens)` is called with the result's tokens AND `router.replace('/home')` is called. Other branches (cancel/access_denied/generic) unchanged. |
| `apps/mobile/__tests__/app/home.test.tsx` | **New.** 4 branches via mocked `useAuth` + `apiGet`: (a) /me success with `name='Matt'` → screen renders "Hello, Matt"; (b) /me success with `name=null, email='matt@example.com'` → "Hello, matt@example.com"; (c) /me failure (e.g. 500) → home-screen-error-root renders with Retry + Sign-out; (d) tap home-screen-sign-out → auth.signOut() + router.replace('/') called. |
| `apps/mobile/__tests__/app/signed-in.test.tsx` | **DELETED** — file no longer exists. |
| `apps/mobile/__tests__/api/client.test.ts` | Unchanged. |
| `apps/mobile/__tests__/auth/pkce.test.ts` | Unchanged. |
| `apps/mobile/__tests__/shared.test.ts` | Unchanged. |

### Smoke-test checklist (not gating per Q9)

The slice-7 stub-fixture-server e2e coverage means **on-device checks
do not gate the slice's "done"** (per the Q9 grilling decision).
The two items below are smoke tests run before merge as a quality
signal — never required, never blocking, never re-run as a regression
gate.

- **Author iPhone smoke test.** Walk through demo §4 steps 3–8 on the
  author's iPhone via Expo Go pointed at the local dev server. Result
  noted in the implementation notes file; failure does not block merge.
- **Keychain inspection.** Xcode device-window Keychain inspector
  shows three `travel_planner.*` entries after sign-in and zero after
  sign-out. Noted in the implementation notes; not a regression gate.

## 10. Observability

- **Logs.** `console.warn` on every non-success branch of
  `runRefreshFlow` with the `code` value only (never tokens). Format:
  `[auth] refresh failed result=<chain_revoked|transient_failure>`.
  `auth-context`'s cold-start logs each branch entry/exit at `info`
  level in `__DEV__` only; production builds suppress these via
  `if (__DEV__)` guards. Same logging discipline as SPEC-006.
- **Metrics.** No new metrics in slice 7. Slice 9 adds Sentry.
- **Sentry / error reporting.** Slice 9. Slice 7's `console.warn` calls
  are deliberately Sentry-shape-compatible (level + tags + extra) so
  slice 9 can wrap them with `Sentry.captureMessage` without
  restructuring call sites.

## 11. Rollback / safety

- **Web side untouched.** No DB changes, no server-side code changes.
  Revertable by `git revert`.
- **Mobile-side rollback.** Reverting the slice's commits means
  scanning the prior Expo Go bundle (SPEC-006 sign-in flow with
  placeholder `signed-in.tsx`). Any Keychain entries from the
  slice-7 sign-in path remain in Keychain but are inert under the
  reverted bundle (slice 6's code path doesn't read them; signed_in
  state is never resumed). User can re-sign-in or manually delete
  via Settings → General → iPhone Storage → Travel Planner.
- **CI rollback.** If the stub fixture server is flaky in week 1, the
  same `continue-on-error: true` escape valve from SPEC-006 step 9
  applies; revert the CI yaml change while keeping the fixture
  server file (which only runs when CI calls it). Decide per-failure
  whether to revert just the new flows (home.yaml + sign-out.yaml)
  or the whole CI step.
- **Cold-start refresh chain corruption.** Theoretical: refresh flow
  rotates Keychain but the user's iPhone dies mid-flight. New tokens
  in Keychain, server has the new tokens recorded; user reopens,
  cold-start uses the new tokens, works. Or: old tokens in Keychain,
  server has the new tokens recorded; user reopens, cold-start tries
  refresh with old token, server reports `invalid_refresh_token`
  (server has a different replaced_by pointer), → `chain_revoked`
  → wipe + signed_out. User re-signs-in. Acceptable.

## 12. Implementation order

Each step pairs intent with verification, small enough to commit on its
own. Tests-first per CONSTITUTION.md §3. Day chunking is rough budget
tracking (2–3d total per the grilling pass).

1. [ ] **Intent:** Add `src/auth/expiry.ts` (`isAccessExpired`) +
   `__tests__/auth/expiry.test.ts` (4 boundary cases). Add `readTokens`
   to `src/auth/keychain.ts` + extend `__tests__/auth/keychain.test.ts`
   (3 new cases: all-present, missing-any, schema-malformed).
   **Verification:** `pnpm --filter @travel-planner/mobile test` passes
   with ~7 new mobile tests. (Day 1 morning.)

2. [ ] **Intent:** Create `src/auth/refresh-flow.ts` (`runRefreshFlow`
   + `runRefreshFlowDedup`) + `__tests__/auth/refresh-flow.test.ts`
   (3 branches + 1 dedupe test). **Verification:** Jest passes (~4
   more tests). (Day 1 morning.)

3. [ ] **Intent:** Create `src/auth/auth-context.tsx` (AuthProvider +
   useAuth hook) + `__tests__/auth/auth-context.test.tsx` (5 cold-start
   branches + 3 action tests). Uses `renderHook` with mocked deps for
   readTokens / runRefreshFlow / storeTokens / clearTokens.
   **Verification:** Jest passes (~8 more tests). (Day 1 afternoon.)

4. [ ] **Intent:** Create `src/auth/splash-view.tsx`,
   `src/auth/cold-start-error-view.tsx`, `src/auth/route-guard.tsx` +
   their tests (3 + 2 + 3 = ~8 cases). `splash-view.tsx` enforces the
   150ms minimum-visible duration per §7 ("Splash visible duration UX").
   **Verification:** Jest passes (~8 more tests); a `splash-view`
   render-then-immediately-unmount test confirms the spinner stays
   mounted for at least 150ms. (Day 1 afternoon / Day 2 morning.)

5. [ ] **Intent:** Modify `src/auth/sign-in-flow.ts` per Q6 — drop
   `storeTokens` from `SignInDeps`; success result becomes
   `{ status: 'success'; tokens }`. **Drop the `email` field**
   too — slice 7's `app/index.tsx` no longer routes via email, and
   the home screen re-fetches /me independently (the slice-6 /me-as-
   proof call still happens inside the orchestrator but its payload
   is discarded). Update `__tests__/auth/sign-in-flow.test.ts`
   accordingly (drop `result.email` assertions; add `result.tokens`
   shape assertion). **Verification:** Jest passes; sign-in-flow's
   5 branches still green. (Day 2 morning.)

6. [ ] **Intent:** Modify `app/index.tsx` sign-in screen — call
   `await auth.signedIn(result.tokens); router.replace('/home')` on
   success instead of router.replace to `/signed-in`. Update
   `__tests__/app/index.test.tsx` (mocks `useAuth`).
   **Verification:** Jest passes. (Day 2 morning.)

7. [ ] **Intent:** Create `app/home.tsx` with the /me-fetch local state
   machine + 4-branch UI per Q7/Q8 + `__tests__/app/home.test.tsx`.
   Delete `app/signed-in.tsx` + `__tests__/app/signed-in.test.tsx`.
   **Verification:** Jest passes (~4 more tests; ~1 fewer). (Day 2
   afternoon.)

8. [ ] **Intent:** Wire `<AuthProvider>` + `<RouteGuard>` into
   `app/_layout.tsx`. Smoke test: `pnpm --filter @travel-planner/mobile
   test` stays green; `pnpm dev:mobile` boots clean (manual eyeball
   of the splash → sign-in transition).
   **Verification:** Jest stays green; Metro starts; sign-in screen
   renders after splash. (Day 2 afternoon.)

9. [ ] **Intent:** Update `.maestro/flows/launch.yaml` to expect
   `splash-view-root` then `login-screen-root`. Run
   `pnpm test:e2e:mobile` locally to confirm (still
   against the no-fixture-server setup, i.e. localhost web). The
   tap-button-and-in-flight assertion from `sign-in.yaml` is unaffected.
   **Verification:** All existing Maestro flows still green locally.
   (Day 2 afternoon.)

10. [ ] **Intent:** Create `tests/e2e/mobile/fixture-server.ts` —
    ~80-line Node `http` server implementing canned
    `/api/v1/auth/mobile/{start,exchange,refresh}` + `/api/v1/me`
    handlers, all responses validated via `@travel-planner/shared`
    schemas before being written to the wire. **Port allocation:** the
    server binds to port `0` (OS-allocated free port) and writes the
    chosen port to `tests/e2e/mobile/fixture-server.port` on boot. This
    avoids CI port collisions with other workflows or future services.
    The CI step in step 11 reads this file before exporting
    `EXPO_PUBLIC_API_BASE_URL`. Add `pnpm test:e2e:mobile:fixture-server`
    script. Draft **ADR-057** (Mobile e2e stub fixture server).
    **Verification:** `node tests/e2e/mobile/fixture-server.ts` boots
    and writes the port file; `curl http://localhost:$(cat
    tests/e2e/mobile/fixture-server.port)/api/v1/me` returns canned
    JSON matching `meResponseSchema`. ADR-057 file written. (Day 3
    morning.)

11. [ ] **Intent:** Update `.github/workflows/ci.yml` `mobile-e2e` job
    — boot the fixture server as a background step before the Maestro
    invocation, set `EXPO_PUBLIC_API_BASE_URL=http://localhost:<port>`
    for the `expo prebuild` + `xcodebuild` chain (per ADR-055's
    pipeline), tear down at job end. Keep `continue-on-error: true`
    per ADR-055's calendar-gated promotion stance — week-1 grace
    period resets to this SPEC's merge date.
    **Verification:** Open a no-op `apps/mobile/**`-touching PR; CI
    job runs the full pipeline end-to-end with fixture server boot +
    Maestro green. (Day 3 morning.)

12. [ ] **Intent:** Create `.maestro/flows/home.yaml` (launch →
    splash → sign-in → fixture-driven success → home renders with
    name) + `.maestro/flows/sign-out.yaml` (continuation: tap
    sign-out → sign-in returns). Run locally against the fixture
    server.
    **Verification:** Both flows pass locally; pushed to PR, CI
    shows them green (or surfaces failure as Maestro artifact).
    (Day 3 afternoon.)

13. [ ] **Intent:** Docs cleanup commit — (a) **ADR-051 new §8
    "Cold-start re-hydration policy"** appended in-place (after §7
    "Future asymmetric signing"; §6 and §7 stay untouched). Documents:
    read Keychain → expiry-with-leeway check → lazy refresh-or-not →
    4-state transition table. (b) `apps/mobile/AGENTS.md` new "Mobile
    auth state" section. Content sketch:
    - Provider mount point (`<AuthProvider>` + `<RouteGuard>` in
      `app/_layout.tsx`).
    - `useAuth()` shape: the 4-variant state union + three actions.
    - Cold-start algorithm summary (read tokens → expiry check with
      60s leeway → lazy refresh → 4-state transition table). Cross-link
      to ADR-051 §8.
    - testID conventions for the new view components (`splash-view-*`,
      `cold-start-error-*`, `home-screen-*`, `home-screen-error-*`).
    - Module-scoped dedupe pattern in `refresh-flow.ts` (when to use
      `runRefreshFlowDedup` vs raw `runRefreshFlow`).
    - Relationship to SPEC-006's sign-in flow + API client section.
    (c) **TD-009** entry in `docs/tech-debt.md` for server-side
    `/revoke`. (d) `docs/specs/README.md` row added. (e) EPIC-001 §7
    slice 7 row → Done; slice ledger close-out row. (f) EPIC-001 §16
    deviation #4 row added (1–2d → 2–3d budget bump).
    **Verification:** `pnpm lint` exits 0; spot-check ADR-051 reads
    coherently end-to-end after the new §8 appended. (Day 3 afternoon.)

14. [ ] **Intent:** Final full verification suite.
    **Verification:** From repo root: `pnpm lint && pnpm
    db:check:migrations && pnpm type-check && pnpm test:unit && pnpm
    test:integration && pnpm build && pnpm test:e2e:web && pnpm
    test:e2e:mobile` all exit 0. Smoke-check on author's iPhone via
    Expo Go (not gating, per Q9). (Day 3 afternoon.)

## 13. ADR triggers and tech-debt review

### ADR?

- [ ] **New library, external tool, or vendor** — N/A. No new deps
      (slice 6's three Expo modules are sufficient; no new Node libs
      for the fixture server — uses Node's built-in `http`).
- [x] **CI pipeline or workflow structural change** — `mobile-e2e` job
      gains a fixture-server boot step + `EXPO_PUBLIC_API_BASE_URL`
      injection. Reusable for every future mobile slice that wants
      Maestro coverage of authenticated screens. **Yes —
      [ADR-057 — Mobile E2E via Stub Fixture Server](../decisions/057-mobile-e2e-stub-fixture-server.md)**
      drafted alongside this SPEC.
- [x] **New project-wide standard** — the mobile-side auth state
      pattern (`useAuth()` + state machine + cold-start algorithm) is
      project-wide for `apps/mobile/`. Documented in `apps/mobile/AGENTS.md`
      rather than an ADR (rationale: the pattern is small + single-app +
      its rationale is "plain Context is the boring React answer" —
      doesn't need ADR-level justification).
- [x] **Non-obvious architectural trade-off** — cold-start lazy refresh
      policy (60s leeway, no /me verification at cold-start, network/5xx
      → cold_start_error). Lands as an **in-place amendment to ADR-051**
      (new **§8 "Cold-start re-hydration policy"** appended after §7
      "Future asymmetric signing"; §6 "Key rotation procedure" and §7
      stay untouched). Same in-place pattern SPEC-006 used to amend
      ADR-052/053/055.
- [ ] **Cross-cutting decision not already settled by the parent
      epic** — N/A; all cross-cutting decisions inherited.

**ADRs to write/amend:**

- **[ADR-057](../decisions/057-mobile-e2e-stub-fixture-server.md)** new
  — stub fixture server pattern for mobile e2e.
- **ADR-051 new §8 — Cold-start re-hydration policy** appended in-place
  (§6 "Key rotation procedure" and §7 "Future asymmetric signing"
  stay untouched).

### Tech debt

- [x] I reviewed `docs/tech-debt.md`:
  - **TD-002** — already Resolved by SPEC-006. No change.
  - **TD-003** — Expo SDK 54 downgrade. Stays open; slice 7 builds on
    SDK 54. Re-upgrade trigger unchanged.
  - **TD-004** — direct on-device OAuth (iOS-type Google client). Stays
    open; slice 7 keeps server-mediated PKCE. Trigger unchanged: EPIC-002 /
    ADP funded.
  - **TD-005** — dev-only dependabot transitives. Unaffected.
  - **TD-006** — TypeScript 5.9.3 → 6.0.x hold. Unaffected.
  - **TD-007** — Vite 7.3.3 → 8.0.x hold. Unaffected.
  - **TD-008** — `@vercel/postgres` deprecation. Unaffected.
- **TD-009** filed in same commit as the spec — server-side
  `/api/v1/auth/mobile/revoke` endpoint deferred. Severity Low.
  Trigger: session-management or "log out everywhere" UX prioritised
  (≈ EPIC-003+).

**Tech debt items addressed by this spec:** None resolved. One added (TD-009).

## 14. Risks & open questions

- **Stub fixture server in CI is first-of-kind.** Same risk class as
  SPEC-006's "EAS Local → raw xcodebuild" pivot. Mitigation: keep
  `mobile-e2e` job at `continue-on-error: true` for week 1 (calendar-
  gated promotion). If the fixture server fails to start reliably on
  macOS-latest runners, fall back to: (a) running it via `expo dev`'s
  built-in process; (b) reverting the new flows and keeping
  `launch.yaml` + `sign-in.yaml` as the slice-7 Maestro coverage. Both
  fallbacks captured in §11.
- **Expo Router gate pattern at SDK 54.** §7's RouteGuard is a plain
  component that wraps the Stack — it does **not** depend on Expo
  Router's `<Stack.Protected />` API (which may or may not exist at
  SDK 54). The pattern works because the layout is a normal React
  tree and we discriminate on `auth.status` before mounting `<Stack />`.
  No fallback needed. If a future Expo Router release adds a more
  idiomatic guard primitive, that's a refactor opportunity, not a
  blocker.
- **Splash visible duration UX.** A 0ms splash flashes badly; a 500ms+
  splash feels broken. The §7 design pins a 150ms minimum via
  `setTimeout`. If the cold-start work resolves in <150ms (which is
  the common case for cached tokens), the splash will linger for the
  remainder of 150ms — that's the intended trade-off. If it feels
  janky on-device, drop the minimum and accept the flash.
- **`runRefreshFlowDedup`'s module-scoped inflight.** Survives across
  unmount/remount of the AuthProvider (which shouldn't happen in
  practice but is theoretically possible during fast-refresh dev
  loops). Mitigation: tests cover the happy path; production risk is
  low because the AuthProvider only mounts once per app boot.
- **Refresh-token rotation race during cold_start_error → Retry.** If
  Retry is double-tapped while the first refresh is inflight, the
  dedupe ensures only one server-side rotation happens. The second
  tap awaits the same Promise. Verified by the dedupe test.
- **Budget bump 1–2d → 2–3d** logged in EPIC-001 §16 as deviation #4.
- **Splash visible duration.** Quality target: splash should resolve
  within ~500ms on a healthy network for the cached-tokens cold-start
  path; the 150ms minimum-visible enforcement (per §7) guarantees the
  splash never *under*-renders. Not gated by §3 acceptance criteria —
  noted here as the design intent.
- **iOS Simulator Keychain persistence in CI.** Each Maestro flow is
  self-contained (signs in fresh from `home.yaml` and `sign-out.yaml`
  too), so cross-flow Keychain state is not relied upon. If the
  Simulator wipes Keychain between flows, each flow still works.

---

## Implementation Deviations

> **Instruction to implementing agent:** During implementation, capture
> deviations and observations as they happen in
> `docs/implementation-notes/SPEC-008-mobile-home-screen-and-sign-out.md`
> (rolling log). At close-out, triage that log and populate this table
> with anything that changed the design intent vs. this approved spec.

| # | Deviation | Reason | Impact | Resolved? |
|---|-----------|--------|--------|-----------|

### Post-Implementation Notes

_To be written at close-out._
