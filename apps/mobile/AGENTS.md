# Mobile App — AGENTS.md

> Rules for `apps/mobile/`. These add specificity to the root AGENTS.md.
>
> The mobile app is an Expo + React Native client that talks to the
> `/api/v1/*` surface from the web app. Per ADR 045 / 052: Expo +
> Expo Router + Expo Go for the entire EPIC-001 phase
> (TestFlight / EAS Build deferred to EPIC-002).
>
> **SDK version: 54** (temporary, per [ADR 053](../../docs/decisions/053-expo-sdk-54-temporary-downgrade.md)
> + [TD-003](../../docs/tech-debt.md)). App Store Expo Go is stuck on
> SDK 54 pending Apple's approval of an SDK 55 build. Do not bump to
> SDK 55 speculatively — wait for the trigger documented in ADR 053.

## Quick reference

| Concern | Where |
|---------|-------|
| App entry | `app/_layout.tsx` (root Stack + `AuthProvider` + `AuthGuard`) |
| Screens | `app/(auth)/*.tsx` (signed-out) + `app/(app)/*.tsx` (signed-in) — Expo Router route groups |
| Auth state | `src/auth/auth-context.tsx` (React Context, 3-state machine: `unknown \| signed_out \| signed_in`) |
| Access tokens | `src/auth/get-access-token.ts` (proactive refresh + single-flight, 60s buffer) |
| Component tests | `__tests__/` mirroring the `app/` tree (Expo Router treats every file in `app/` as a route — see ADR 053) |
| E2E flows | `.maestro/flows/*.yaml` (one per user journey) |
| API mocks | `jest.spyOn(globalThis, 'fetch')` inline per test (see "API mocking" section). |
| Metro pnpm config | `metro.config.js` — **do not touch without reading ADR 053** (SDK 54 default-config, supersedes ADR 052 §3) |
| Test framework setup | `jest.config.js` + `jest.setup.ts` |
| App identifier | `app.json` → `expo.ios.bundleIdentifier` (`dev.matthewcarr.travelplanner`) |
| URL scheme | `app.json` → `expo.scheme` (`travelplanner://`) |

## Dev loop

From the repo root:

```bash
pnpm dev:mobile        # starts Expo Metro; prints QR code
pnpm test:mobile       # Jest unit + component tests (mobile only)
pnpm test:mobile:watch # Jest watch mode (TDD loop)
pnpm test:e2e:mobile   # Maestro E2E only (requires Maestro + iOS Simulator)
pnpm test:e2e          # umbrella — Playwright (web) + Maestro (mobile) together
pnpm type-check:mobile # tsc --noEmit on the mobile app only
pnpm lint              # repo-wide Biome — lints apps/mobile/app/** + apps/mobile/*.{ts,tsx,js,mjs} via biome.json includes
```

To run on the author's iPhone: scan the QR with the Expo Go app
(install from App Store). Expo Go runs the unsigned bundle
indefinitely — no Apple Developer Program required.

To run on the iOS Simulator: press `i` in the Metro CLI after
`pnpm dev:mobile`.

### Pointing the app at a backend (`EXPO_PUBLIC_API_BASE_URL`)

The mobile app reads its API base URL from
`process.env.EXPO_PUBLIC_API_BASE_URL` at bundle time, defaulting to
`http://localhost:3000`. `EXPO_PUBLIC_*` env vars are inlined by Expo,
so set them inline when starting Metro:

```bash
# iOS Simulator (localhost works because the simulator shares the host network)
pnpm dev:mobile

# Author's iPhone via Expo Go on the LAN (replace with your Mac's LAN IP)
EXPO_PUBLIC_API_BASE_URL=http://192.168.1.42:3000 pnpm dev:mobile
```

If the iPhone is on a captive-portal network (coffee shop, hotel)
that blocks LAN traffic, on-device dev won't work; fall back to the
Simulator. Future EPIC-002 work provisions a public hostname so this
LAN-IP dance goes away.

## Architecture

`apps/mobile/` has two top-level source trees:

- **`app/`** — Expo Router routes ONLY. Every file under `app/` is
  treated as a route by the router. Never put non-route logic or test
  files here (ADR 053). Routes are partitioned into two **route groups**
  (parens in the directory name are "silent" — they add no URL segment):
  - `app/_layout.tsx` — root layout. Wraps in `<AuthProvider>` and
    `<AuthGuard>`; holds the native splash via
    `expo-splash-screen.preventAutoHideAsync()` until cold-start
    resolves; redirects between the two groups based on auth state.
  - `app/(auth)/sign-in.tsx` — sign-in screen at URL `/sign-in`.
    Visible when `auth.status === 'signed_out'`.
  - `app/(app)/index.tsx` — me screen at URL `/`. Visible when
    `auth.status === 'signed_in'`. EPIC-002's trips list will live
    under `(app)/` too.
  - Both groups have a thin `_layout.tsx` (Stack with
    `headerShown: false`).
  - **Never create a bare `app/index.tsx`** — it would collide with
    `app/(app)/index.tsx` (both resolve to `/`).
- **`src/`** — Non-route logic modules, mirroring `apps/web/src/`'s
  convention. Today: `src/auth/` (PKCE primitives, Keychain wrapper,
  sign-in orchestrator, auth Context, proactive-refresh gateway) and
  `src/api/` (fetch wrapper validating responses via
  `@travel-planner/shared` schemas; supports 204 No Content for
  endpoints like `/revoke`). Add new subdirectories as feature areas
  land (e.g. `src/trips/` when EPIC-002's trips list ships).

### Auth machinery (slices 6 + 7 — SPEC-006 + SPEC-007)

- `src/auth/pkce.ts` — `generateVerifier()` + `verifierToChallenge()`
  over `expo-crypto`. RFC 7636 base64url, 43-char SHA-256 hash.
- `src/auth/keychain.ts` — `storeTokens()` + `readTokens()` +
  `clearTokens()` over `expo-secure-store`. Three discrete keys for
  the access/refresh/expires triple. `readTokens()` returns `null`
  if any key is missing (partial-state defensive).
- `src/auth/sign-in-flow.ts` — `runSignInFlow(deps)` orchestrates the
  four-step server-mediated PKCE dance (start → browser modal →
  exchange → return tokens). The slice-6 `/me`-as-proof + `storeTokens`
  steps moved into `AuthProvider.signIn` (SPEC-007 §7.3 reshape).
  Returns `SignInResult = { success; tokens } | { cancelled } |
  { error }`.
- `src/auth/get-access-token.ts` — proactive refresh gateway. Every
  authenticated `/api/v1/*` call should route through here to obtain
  its bearer. Reads Keychain; if `now < expires_at - 60s` returns
  the current access token, else calls `/refresh` (single-flight via
  module-level promise mutex). On refresh failure, clears Keychain
  and returns `{ ok: false, reason: 'refresh_failed' }`. Single-flight
  is load-bearing: ADR 054's reuse-detection would revoke the chain
  on a duplicate `/refresh` with the same refresh token.
- `src/auth/auth-context.tsx` — React Context owning the 3-state
  auth machine. Cold-start in `useEffect` on mount: getAccessToken
  → /me → state transition. ALL /me failures collapse to signed_out
  + clear Keychain (Q8 in SPEC-007). `signIn(tokens)` runs storeTokens
  → /me with rollback on failure. `signOut()` reads tokens first,
  flips state + clears Keychain optimistically, then fire-and-forget
  POST `/api/v1/auth/mobile/revoke` in the background.
- `src/api/client.ts` — `apiPost<T>` / `apiGet<T>` over native fetch,
  validating responses via `@travel-planner/shared` schemas. After
  SPEC-008 / ADR 056 the wrapper expects every `/api/v1/*` body to
  carry the standard envelope: 2xx bodies are parsed with
  `apiSuccessSchema(responseSchema)` and `.data` is returned; 4xx/5xx
  bodies are parsed with `apiErrorEnvelopeSchema` and the RFC 7807
  `error` object (which still carries our closed `code` enum) is
  returned. The `responseSchema` parameter is optional — omit it for
  endpoints with no useful body (e.g. `/revoke`, which returns 204 No
  Content); the wrapper then resolves to `{ ok: true; data: undefined }`
  and skips envelope parsing. Wire-shape drift throws loud. Malformed
  error bodies and network failures collapse to a synthetic
  `code: 'internal'` `ApiError` so callers can dispatch on `error.code`
  uniformly.

When adding a new authenticated `/api/v1/*` call:

1. Import the request + response schemas from `@travel-planner/shared`
   (or extend the shared package if the wire shape is new).
2. Obtain the bearer via `getAccessToken()` — never call
   `readTokens()` directly. The gateway handles refresh + single-flight.
3. Use `apiPost` / `apiGet` from `src/api/client.ts`. Pass the
   response schema; the wrapper does `.parse()` automatically. Omit
   it for 204 endpoints.

### File-system routing (Expo Router) + auth groups

- Route groups (parens in the directory name) are silent — they add
  no URL segment. So `app/(app)/index.tsx` is at `/` and
  `app/(auth)/sign-in.tsx` is at `/sign-in`.
- **No bare `app/index.tsx`** — it would collide with
  `app/(app)/index.tsx` at URL `/`.
- `app/<name>.tsx` is a route at `/<name>` (when not inside a group).
- `app/<name>/<sub>.tsx` is a nested route.
- `app/_layout.tsx` wraps a directory with a layout component. The
  root `_layout.tsx` holds the AuthGuard + splash logic.
- Modal/transparent presentations: see Expo Router docs.

### AuthGuard

`app/_layout.tsx`'s `<AuthGuard>` uses the canonical Expo Router
pattern (`useSegments()` + `useRouter()` in a `useEffect`) to keep
the active route in sync with `auth.status`:

- `auth.status === 'unknown'` → no redirect; native splash held.
- `auth.status === 'signed_in'` + inside `(auth)/` → `replace('/')`.
- `auth.status === 'signed_out'` + inside `(app)/` → `replace('/sign-in')`.

The splash hides once auth leaves 'unknown'. MeScreen at
`app/(app)/index.tsx` returns `null` while auth is 'unknown' or
'signed_out', so the splash is what the user sees during cold-start.

### TestID convention (load-bearing for Maestro)

Every interactive element AND every screen-root view MUST carry a
stable `testID`. Naming pattern: `<screen>-<element>`.

Examples:

- Root `<SafeAreaView>` of `app/index.tsx` → `testID="login-screen-root"`
- Sign-in button → `testID="login-google-button"`
- Inline sign-in error text → `testID="login-screen-error"`
- Root of `app/signed-in.tsx` → `testID="signed-in-screen-root"`
- Email display on signed-in → `testID="signed-in-screen-email"`
- Me screen sign-out (slice 7+) → `testID="me-screen-sign-out"`

Maestro flows reference these rather than visible text. Text
changes are cheap; testID changes break flows.

### Component testing (Jest + RNTL)

Tests live under `apps/mobile/__tests__/` mirroring the `app/` tree.
**Never put test files inside `app/`** — Expo Router would treat
them as routes and bundle them into the iOS app, which then pulls
RNTL's Node-only `console` / `util` requires into the native bundle
and crashes the bundler (see ADR 053).

For `app/foo.tsx` the test lives at `__tests__/app/foo.test.tsx` and
imports the source as `from '../../app/foo'`. Route-group screens
mirror the same shape: `app/(auth)/sign-in.tsx` →
`__tests__/app/(auth)/sign-in.test.tsx`, importing
`from '../../../app/(auth)/sign-in'`. Use
`@testing-library/react-native` queries (`screen.getByTestId`,
`screen.getByText`, etc.) and `fireEvent.press(element)` for
`Pressable` interactions (NOT `element.props.onPress()` — RNTL
doesn't surface onPress as a prop). Extend-expect matchers
(`toBeOnTheScreen`, `toHaveTextContent`) are wired in
`jest.setup.ts`.

```tsx
// __tests__/app/my-screen.test.tsx
import { render, screen } from '@testing-library/react-native';
import MyScreen from '../../app/my-screen';

describe('MyScreen', () => {
  it('renders the heading', () => {
    render(<MyScreen />);
    expect(screen.getByTestId('my-screen-heading')).toBeOnTheScreen();
  });
});
```

### API mocking (fetch spy)

Slice 6 introduced the first `/api/v1/*` calls. Network mocking
uses `jest.spyOn(globalThis, 'fetch')` directly per test —
Node 18+ provides a global `fetch`, jest can spy on it, and
canned `Response` objects cover the needed scenarios. See
`apps/mobile/src/api/client.ts` for the wrapper this fronts and
`apps/mobile/__tests__/api/client.test.ts` for the canonical
test shape.

```ts
const spy = jest.spyOn(globalThis, 'fetch');
spy.mockResolvedValueOnce(
  new Response(JSON.stringify({ message: 'pong' }), { status: 200 }),
);
const result = await apiPost('/api/v1/echo', {}, echoResponseSchema);
expect(result).toEqual({ ok: true, data: { message: 'pong' } });

afterEach(() => jest.restoreAllMocks());
```

**Why not msw?** Evaluated during SPEC-006 step 4 and deferred —
msw 2.x's transitive ESM dependency graph (`rettime`, `until-async`,
`outvariant`, `@bundled-es-modules/*`, ...) needs substantial
`transformIgnorePatterns` + `moduleNameMapper` expansion under
jest-expo 54 to load. The fetch-spy pattern has zero third-party
surface area, ships no new transform config, and covers slice 6's
test needs without ongoing maintenance. The `msw` dep is still in
`devDependencies` for a future spec to revisit if richer request
matching / response templating / multi-handler routing becomes a
real test need. To reactivate, see the SPEC-006 implementation
notes for the configuration sketch.

### Maestro flows (E2E)

One YAML per user journey under `.maestro/flows/`. Examples:

- `launch.yaml` — app boots and the Hello screen renders.
- `login.yaml` — slice 6's sign-in journey.
- `me-screen.yaml` — slice 7's milestone journey.

Use `id:` selectors over visible-text selectors where possible.

## Pnpm + Metro

The repo uses pnpm's isolated linker. As of Expo SDK 54+,
`expo/metro-config`'s `getDefaultConfig()` detects the pnpm workspace
and configures `watchFolders`, `resolver.nodeModulesPaths`, and
symlink resolution automatically — so `metro.config.js` is just the
minimal `getDefaultConfig(__dirname)` call. ADR 053 supersedes ADR 052
§3 here. **Do not re-add manual `watchFolders` / `nodeModulesPaths` /
`disableHierarchicalLookup` overrides** — they break transitive-dep
resolution under SDK 54 (the bug ADR 053 fixes). The hoisted-linker
escape hatch from ADR 052 §3 still stands if Metro regresses on pnpm
in a future SDK.

## Doc review — keeping mobile docs true

| You changed… | Check these docs |
|---|---|
| `app/` structure or routing | This file's "Architecture" section |
| Add a new screen / Maestro flow / testID convention | This file's "Quick reference" + an entry per convention |
| `metro.config.js` | ADR 052; smoke-test that `pnpm dev:mobile` still resolves all imports |
| Expo SDK version (`package.json`) | [ADR 053](../../docs/decisions/053-expo-sdk-54-temporary-downgrade.md) (current pin is SDK 54) and ADR 052 §1 (original SDK rationale); verify jest-expo + RNTL versions still match the new SDK's bundled-native-modules manifest |
| `app.json` (`bundleIdentifier`, `scheme`) | ADR 052; any active Maestro flows referencing the bundleIdentifier |
| CI workflow (mobile jobs in `.github/workflows/ci.yml`) | This file's "Dev loop" section; ADR 052's CI table; ADR 055 for the `mobile-e2e` build pipeline |
| `src/auth/` or `src/api/` shape | This file's "Sign-in flow + API client" section; SPEC-006 for the slice 6 design rationale |
| `@travel-planner/shared` wire shapes consumed from mobile | SPEC-005 (shared package design); coordinate any breaking change with `apps/web/`'s consumers |

## Prerequisites for future slices

These are tracked here because they don't belong in the SPEC files
they depend on (the prerequisite is "future-you ran a test before
opening the next SPEC").

- [x] **`mobile-e2e` CI job actually runs flows** — resolved by
  SPEC-006 step 9 + ADR-055. The job runs `expo prebuild` +
  `xcodebuild` + simulator install + Maestro flows on every
  `apps/mobile/**`-touching PR. Promoted to blocking on 2026-05-22
  after the Debug → Release build fix surfaced that the week-1
  `continue-on-error: true` buffer was masking real failures
  reaching `main`.
- ~~**Partner-device Expo Go validation**~~ — resolved 2026-05-20
  per EPIC-001 §13 Q1: partner cannot reliably run Expo Go on her
  iPhone for the EPIC-001 demo loop, so the on-device demo line in
  §4 narrows to the author's iPhone only. Partner re-enters scope
  at EPIC-002 once TestFlight via ADP is funded.
