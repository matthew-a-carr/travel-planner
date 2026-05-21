# SPEC-006: Mobile Sign-In UI + PKCE Flow + Keychain

**Date:** 2026-05-20
**Status:** Complete
**Author:** Matt Carr (with Claude Opus 4.7 via `plan-feature` + `grill-me`)
**Approved by:** Matt Carr, 2026-05-20 (after `review-spec` pass + one round of patches, including drafting ADR-055)
**Completed:** 2026-05-21
**Parent epic:** [EPIC-001 — iOS App](../epics/EPIC-001-ios-app.md) — slice 6

---

## 1. Summary

Ship the mobile half of the server-mediated PKCE OAuth flow on
`apps/mobile/`. Replace the placeholder "Hello, Travel Planner" entry
screen with a sign-in screen carrying a "Sign in with Google" button.
Tapping the button drives a five-step orchestration:

1. Generate a PKCE verifier + SHA-256 challenge on-device (`expo-crypto`).
2. `POST /api/v1/auth/mobile/start` with the challenge → receive
   `authorise_url` + `state`.
3. Open `authorise_url` in an in-app modal browser via
   `expo-web-browser.openAuthSessionAsync(...)` and await the return
   deep link.
4. Parse `travelplanner://auth?code=…` (success) or
   `travelplanner://auth?error=…` (one of the five
   `MobileAuthCallbackError` reasons). `POST /api/v1/auth/mobile/exchange`
   with `{ code, code_verifier }` → receive `{ access_token,
   refresh_token, access_expires_at }`.
5. `GET /api/v1/me` with the new bearer **to prove the token round-trips**.
   Only then write the three tokens to iOS Keychain (`expo-secure-store`,
   three discrete keys) and navigate to a placeholder `/signed-in?email=…`
   screen.

Slice 6 is server-mediated-PKCE only (TD-004's switch to direct
on-device OAuth via `expo-auth-session` + iOS-type Google client stays
deferred to EPIC-002). Slice 6 also **pays down TD-002**: the
`mobile-e2e` GitHub Actions job stops being a placeholder, builds a
dev-client via `expo prebuild` + EAS Local, boots the iOS Simulator, and
runs a new `sign-in.yaml` Maestro flow on every `apps/mobile/**` PR.

User-visible impact: the demo's lines 3–5 ("tap **Sign in with Google**"
→ OAuth in the system browser → deep-link back to a signed-in placeholder)
work end-to-end on the author's iPhone via Expo Go. Lines 6–7
("Hello, Matt" + sign-out) are slice 7's bar.

## 2. Motivation

EPIC-001 §7 slice 6: build the mobile sign-in UI + PKCE flow + Keychain
storage. Single most uncertain slice in the epic per §8 (sits on top of
both the server side from slices 1–3 and the mobile shell from slice 5;
loosely budgeted at 3–4 days, now 4–5 with the TD-002 pay-down).

Inherited from EPIC-001 §10 (not re-litigated):

- **Mobile framework**: Expo + Expo Router on SDK 54 (per ADR 053, until
  Apple approves SDK 55 Expo Go).
- **Mobile auth model**: PKCE → 15m HS256 access tokens + 30d opaque
  rotating refresh tokens with reuse detection. iOS Keychain via
  `expo-secure-store`.
- **API transport**: plain Route Handlers; cookie OR bearer resolves to
  the same `User`.
- **Shared types**: `@travel-planner/shared` is the wire-shape source of
  truth (SPEC-005).
- **Mobile test runner**: Jest (`jest-expo` preset) + RNTL + msw/native.
- **Mobile E2E**: Maestro YAML, path-filtered macOS CI job.

The grilling session resolved the slice-altitude design questions; see
`docs/specs/_draft-006-mobile-sign-in-pkce-keychain.superseded.md` for
the full Q→A trail. The load-bearing decisions:

- Server-mediated PKCE (not `expo-auth-session`'s client-as-OAuth-client).
- `expo-web-browser.openAuthSessionAsync` (not `Linking` + listener).
- Slice 6 calls `/me` once as proof of bearer; navigates to placeholder.
- Strict cold-start (no Keychain read on launch — slice 7 wires that).
- Three discrete Keychain keys (not a JSON blob).
- Native `fetch` + thin `apiClient.ts` with shared-schema validation.
- Coarse 3-state UI machine + two-bucket error UX.
- Pay down TD-002 inside this slice (matches AGENTS.md "Decision-making
  bias: prefer durable over expedient", codified in the same lineage of
  commits).

## 3. Acceptance criteria

1. Given a fresh checkout, when I run
   `EXPO_PUBLIC_API_BASE_URL=http://<lan-ip>:3000 pnpm dev:mobile` after
   `pnpm install`, then Metro starts and the author's iPhone (via
   Expo Go) loads a screen showing a "Sign in with Google" button with
   `testID="login-google-button"`.
2. Given the sign-in screen is idle, when I tap "Sign in with Google",
   then the OS browser modal opens showing Google's OAuth consent page
   for the configured `AUTH_GOOGLE_ID`.
3. Given I am pre-approved in the `users` table (`isApproved = true`),
   when I complete Google OAuth in the modal, then the modal closes and
   the app navigates to `/signed-in?email=...` displaying my email
   address (no other fields rendered — that's slice 7's bar).
4. Given a successful sign-in, when I inspect iOS Keychain via the dev
   tools, then three values exist under the app's namespace:
   `access_token` (JWT string), `refresh_token` (opaque), and
   `access_expires_at` (ISO 8601 UTC string).
5. Given I force-quit the app and reopen it via Expo Go, then the
   sign-in screen renders again (cold-start recovery is deferred to
   slice 7 — see §5).
6. Given the OAuth modal is open, when I dismiss it without completing,
   then the app returns to its idle sign-in state with no error UI.
7. Given I attempt to sign in with a Google account that is not in the
   `users` table (or whose `isApproved = false`), when the callback
   completes, then the app shows the `access_denied` error copy
   ("Sign-in is restricted. Ask the app admin to approve your account.")
   and writes nothing to Keychain.
8. Given any other failure on the callback (`invalid_state`,
   `google_error`, `invalid_request`, `server_error`) or any
   `/exchange` envelope error (`invalid_exchange_code`, `pkce_mismatch`,
   `validation_failed`, `rate_limited`, `internal`, network), when the
   flow surfaces it, then the app shows the generic "Sign-in failed.
   Try again." copy with a small `[code: <code>]` debug tag and writes
   nothing to Keychain.
9. Given a successful `/exchange` but a failing `/me` (impossible in
   practice — would indicate signing-key drift), when the proof step
   fails, then no tokens are persisted and the app shows the generic
   error UX.
10. Given the new component tests, when I run
    `pnpm --filter @travel-planner/mobile test`, then it covers — at
    minimum — the four sign-in branches (success, cancel, access_denied,
    generic error) plus the `apiClient.ts` success-and-error envelope
    parsing.
11. Given the new Maestro flow, when I run
    `pnpm test:e2e:mobile`, then
    `.maestro/flows/sign-in.yaml` runs against the iOS Simulator and
    asserts: app launches → sign-in screen renders with the
    `login-google-button` testID → tapping the button transitions UI
    state (a spinner or any observable in-flight indicator surfaces).
    It does NOT drive the real Google OAuth.
12. Given a `apps/mobile/**` PR, when CI runs, then the `mobile-e2e`
    job executes Maestro flows for real (not the placeholder); the
    Job builds a dev-client via `expo prebuild` + `eas build --local
    --profile development --platform ios`, boots the iOS Simulator,
    installs the build, and runs every flow under `.maestro/flows/`.
    Path filter remains `apps/mobile/**`.
13. Given the full verification suite at SPEC close-out,
    `pnpm lint && pnpm db:check:migrations && pnpm type-check &&
    pnpm test:unit && pnpm test:integration` all exit 0 from the repo
    root; the production build
    `POSTGRES_URL=... pnpm build` exits 0; web-side tests stay green
    unchanged (SPEC-001/002/004 + the SPEC-005 .parse() assertions).

## 4. Demo script

1. On a freshly cloned repo, `pnpm install` then `pnpm dev` — web app
   serves at `http://localhost:3000` unchanged.
2. In another shell, look up the Mac's LAN IP (e.g. `192.168.1.42`),
   then run
   `EXPO_PUBLIC_API_BASE_URL=http://192.168.1.42:3000 pnpm dev:mobile`.
   Expo prints a QR code in the terminal.
3. On the author's iPhone, open Expo Go and scan the QR. The bundle
   loads; the sign-in screen appears.
4. Tap **Sign in with Google**. The system browser modal opens with
   Google's OAuth consent screen (first launch shows iOS's
   "this app wants to use Google to sign in" warning — expected).
5. Sign in with the author's pre-approved Google account. Google
   redirects to the web server's callback URI; the server redirects
   to `travelplanner://auth?code=<one-time>`; the modal auto-closes;
   the app's `openAuthSessionAsync` promise resolves; `/exchange`
   succeeds; `/me` succeeds; tokens land in Keychain.
6. The app navigates to the placeholder `/signed-in` screen showing
   "Signed in as `<author-email>`." Force-quit the app to leave
   Keychain in its post-sign-in state.
7. Reopen the app via Expo Go — the sign-in screen renders again
   (cold-start recovery is slice 7's; tokens stay in Keychain
   untouched).
8. In a separate run, sign in with a Google account that's NOT in the
   `users` table. After Google OAuth the deep link carries
   `?error=access_denied`; the app surfaces the closed-auth copy
   ("Sign-in is restricted. Ask the app admin to approve your
   account.") with no Keychain write.
9. Open a PR touching `apps/mobile/` and watch CI: the `mobile-e2e`
   job builds the dev-client, boots the simulator, runs
   `sign-in.yaml`, and either passes or surfaces the failure log
   as an artifact.

## 5. Out of scope

Inherited from EPIC-001 §6 / §10:

- No App Store / TestFlight / EAS Build signed builds / APNs / Android.
- No tRPC / ts-rest / GraphQL.
- No Server Action replacement on web.

Specific to this slice:

- **Cold-start auth recovery.** Slice 6 doesn't read Keychain at
  launch; reopening shows the sign-in screen. Slice 7 wires the read
  path + refresh-on-expired + sign-out-on-refresh-failure.
- **Sign-out.** Slice 7 ships the affordance + the Keychain wipe.
- **Refresh-token rotation.** Slice 6 never calls `/refresh`. First
  use is slice 7's.
- **The "Hello, {name}" home screen.** Slice 6's `/signed-in` placeholder
  intentionally shows only "Signed in as {email}." so slice 7 has a
  concrete file to fill in.
- **Maestro driving real Google OAuth.** Google's anti-automation
  rejects scripted credentials; the flow stops at the observable
  "modal opens" step.
- **Sentry mobile.** Slice 9.
- **Universal Links** (https-based deep links). Custom scheme only.
- **Global auth Context / state library.** One screen consumes the
  in-flight state; slice 7 introduces the Context when sign-out +
  cold-start add consumers.
- **Cancellation telemetry / "you cancelled" copy.** Treat as no-op.
- **Network-class differentiation.** No "you're offline" vs
  "5xx" distinction.
- **iOS-type Google client.** TD-004 deferred to EPIC-002.
- **Slice 7's full test plan.** Slice 6 stops at the four sign-in
  branches; slice 7 owns the cold-start + refresh test matrix.

## 6. Prerequisites

- EPIC-001 slices 1–5 Done (SPEC-001, SPEC-002, SPEC-003, SPEC-004,
  SPEC-005). ✅ All Done as of 2026-05-20.
- `apps/mobile/` exists with Expo SDK 54, stock Metro config (ADR 053),
  scheme `travelplanner` already registered in `app.json` (per SPEC-003).
  ✅ Done.
- `@travel-planner/shared` exports the wire shapes this slice consumes
  (`mobileAuthStartRequestSchema`, `mobileAuthStartResponseSchema`,
  `mobileAuthExchangeRequestSchema`, `mobileAuthExchangeResponseSchema`,
  `mobileAuthCallbackErrorSchema`, `meResponseSchema`,
  `apiErrorBodySchema`). ✅ Done in SPEC-005.
- Author's Google account is pre-provisioned in the `users` table with
  `isApproved = true` (`pnpm auth:bootstrap-admin -- <email> "<name>"`
  on the appropriate environment).
- Author's iPhone has App Store Expo Go installed and successfully
  rendered the SDK 54 Hello screen (SPEC-003 partner-device prerequisite
  was author-only; that prerequisite is checked off for the author by
  slice 5's close-out).
- macOS CI runner availability for the `mobile-e2e` job — already
  configured (path-filtered) by SPEC-003; pay-down work in this slice
  fills in the existing job's placeholder step.
- No new env vars on the SERVER side. New CLIENT-side env var
  introduced: `EXPO_PUBLIC_API_BASE_URL` (defaults to
  `http://localhost:3000`).

## 7. Design

### Layer layout (new in this slice)

`apps/mobile/` gains a `src/` tree for non-route logic, mirroring
`apps/web/src/`'s convention. Expo Router still owns `apps/mobile/app/`
for routes only.

```
apps/mobile/
├── app/
│   ├── _layout.tsx              (unchanged)
│   ├── index.tsx                (rewritten: sign-in screen)
│   └── signed-in.tsx            (new: placeholder)
├── src/
│   ├── auth/
│   │   ├── pkce.ts              (new)
│   │   ├── keychain.ts          (new)
│   │   └── sign-in-flow.ts      (new — orchestrator)
│   └── api/
│       └── client.ts            (new — fetch wrapper + schema validation)
├── __tests__/
│   ├── app/
│   │   ├── index.test.tsx       (rewritten: 4 sign-in branches)
│   │   └── signed-in.test.tsx   (new — placeholder render test)
│   ├── auth/
│   │   ├── pkce.test.ts         (new — verifier/challenge)
│   │   └── sign-in-flow.test.ts (new — orchestration with mocked deps)
│   ├── api/
│   │   └── client.test.ts       (new — fetch wrapper + schema parse)
│   └── shared.test.ts           (unchanged from SPEC-005)
└── .maestro/
    └── flows/
        ├── launch.yaml          (unchanged from SPEC-003)
        └── sign-in.yaml         (new)
```

### Data & types (mobile side)

No new domain types beyond what `@travel-planner/shared` already exports.
Two thin mobile-internal types (not exported):

```ts
// apps/mobile/src/auth/sign-in-flow.ts
type SignInResult =
  | { status: 'success'; email: string }
  | { status: 'cancelled' }
  | { status: 'error'; reason: 'access_denied' | 'generic'; code: string };

type AuthTokens = z.infer<typeof mobileAuthExchangeResponseSchema>;
```

### Behaviour

**`apps/mobile/src/auth/pkce.ts`** — pure functions over `expo-crypto`:

- `async function generateVerifier(): Promise<string>` — produces a
  43-char base64url string from 32 random bytes via
  `Crypto.getRandomBytesAsync(32)`.
- `async function verifierToChallenge(verifier: string): Promise<string>`
  — produces the SHA-256 base64url challenge via
  `Crypto.digestStringAsync(SHA256, verifier, { encoding: 'base64url' })`.

**`apps/mobile/src/auth/keychain.ts`** — narrow wrapper over
`expo-secure-store`:

```ts
const ACCESS_TOKEN_KEY = 'travel_planner.access_token';
const REFRESH_TOKEN_KEY = 'travel_planner.refresh_token';
const ACCESS_EXPIRES_AT_KEY = 'travel_planner.access_expires_at';

export async function storeTokens(tokens: AuthTokens): Promise<void>;
export async function clearTokens(): Promise<void>;
// readTokens() is intentionally NOT exported in slice 6 (cold-start
// recovery deferred to slice 7).
```

**`apps/mobile/src/auth/sign-in-flow.ts`** — the orchestrator. Public
surface:

```ts
export type SignInDeps = {
  apiPost: typeof import('../api/client').apiPost;
  apiGet: typeof import('../api/client').apiGet;
  openAuthSession: typeof WebBrowser.openAuthSessionAsync;
  generateVerifier: typeof import('./pkce').generateVerifier;
  verifierToChallenge: typeof import('./pkce').verifierToChallenge;
  storeTokens: typeof import('./keychain').storeTokens;
};

export async function runSignInFlow(deps: SignInDeps): Promise<SignInResult>;
```

The function-with-injected-deps shape exists so the component test
mocks the four boundary surfaces (HTTP, browser, crypto, keychain)
without touching the orchestration logic.

Internal flow:

1. `verifier = await generateVerifier()`; `challenge = await verifierToChallenge(verifier)`.
2. `start = await apiPost('/api/v1/auth/mobile/start', { code_challenge: challenge }, mobileAuthStartResponseSchema)`.
   On `!start.ok`: return `{ status: 'error', reason: 'generic', code: start.error.code }`.
3. `browserResult = await openAuthSession(start.data.authorise_url, 'travelplanner://auth')`.
   On `type: 'cancel' | 'dismiss'`: return `{ status: 'cancelled' }`.
4. Parse `browserResult.url`. If `?error=<reason>`: parse `reason` via
   `mobileAuthCallbackErrorSchema.safeParse(...)`.
   - On `access_denied`:
     `{ status: 'error', reason: 'access_denied', code: 'access_denied' }`.
   - On any other valid enum value (`invalid_request`, `server_error`,
     `invalid_state`, `google_error`):
     `{ status: 'error', reason: 'generic', code: <the parsed value> }`.
   - When `safeParse` fails (the string doesn't match any union member):
     `{ status: 'error', reason: 'generic', code: 'unknown_callback_error' }`.
5. Extract `code` from `?code=<one-time>`. If missing:
   `{ status: 'error', reason: 'generic', code: 'no_code_in_callback' }`.
6. `exchange = await apiPost('/api/v1/auth/mobile/exchange', { code, code_verifier: verifier }, mobileAuthExchangeResponseSchema)`.
   On `!exchange.ok`: return `{ status: 'error', reason: 'generic', code: exchange.error.code }`.
7. `me = await apiGet('/api/v1/me', meResponseSchema, exchange.data.access_token)`.
   On `!me.ok`: return `{ status: 'error', reason: 'generic', code: me.error.code }`.
   (Tokens NOT persisted on /me failure.)
8. `await storeTokens(exchange.data)`. (Only persist on full happy path.)
9. Return `{ status: 'success', email: me.data.email }`.

**`apps/mobile/src/api/client.ts`** — fetch wrapper:

```ts
const BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:3000';

type ApiSuccess<T> = { ok: true; data: T };
type ApiFailure = { ok: false; error: ApiErrorBody['error'] };

export async function apiPost<T>(
  path: string,
  body: unknown,
  responseSchema: z.ZodType<T>,
  bearer?: string,
): Promise<ApiSuccess<T> | ApiFailure>;

export async function apiGet<T>(
  path: string,
  responseSchema: z.ZodType<T>,
  bearer?: string,
): Promise<ApiSuccess<T> | ApiFailure>;
```

Body construction:

- Serialises `body` as JSON, sets `Content-Type: application/json`.
- If `bearer` provided, sets `Authorization: Bearer <jwt>`.
- On `!res.ok`: parses body via `apiErrorBodySchema.safeParse`. If
  it parses, returns `{ ok: false, error: parsed.error }`. If it
  doesn't, returns `{ ok: false, error: { code: 'internal', message: 'Unexpected error.' } }`.
- On `res.ok`: parses body via `responseSchema.parse` (throws on shape
  mismatch — that's a wire-shape drift bug, surface loud).
- On network errors (`fetch` throws): catches and returns
  `{ ok: false, error: { code: 'internal', message: 'Network unreachable.' } }`.

**`apps/mobile/app/index.tsx`** (sign-in screen) — single-component:

```ts
type ScreenState =
  | { status: 'idle' }
  | { status: 'in_flight' }
  | { status: 'error'; reason: 'access_denied' | 'generic'; code: string };
```

Renders:

- Idle: prominent "Sign in with Google" button with
  `testID="login-google-button"`. On press: set state to `in_flight`,
  await `runSignInFlow({ ... })`.
- In-flight: button disabled with a spinner; the OS browser modal will
  cover the UI for most of this state anyway.
- Error (access_denied): replaces the button with the closed-auth copy
  + a "Got it" affordance that returns to idle.
- Error (generic): inline error text below the button ("Sign-in failed.
  Try again. [code: <code>]"); button re-enabled; tap retries.

On `result.status === 'success'`:
`router.replace({ pathname: '/signed-in', params: { email: result.email } })`.

On `result.status === 'cancelled'`: silently return to idle.

**`apps/mobile/app/signed-in.tsx`** (placeholder):

```ts
const { email } = useLocalSearchParams<{ email: string }>();
return (
  <SafeAreaView testID="signed-in-screen-root">
    <Text testID="signed-in-screen-email">{`Signed in as ${email}.`}</Text>
  </SafeAreaView>
);
```

No sign-out, no `/me` refetch on focus. Slice 7's bar.

### Storage & migrations

No DB migrations. Mobile-side storage uses iOS Keychain via
`expo-secure-store` — per-app, per-device, opaque to the server.
Three keys (defined in `keychain.ts`):

- `travel_planner.access_token`
- `travel_planner.refresh_token`
- `travel_planner.access_expires_at`

### External integrations

- **Google OAuth.** Reuses the existing `AUTH_GOOGLE_ID` web client.
  The mobile app does NOT talk to Google directly — `/api/v1/auth/mobile/start`
  hands back the authorise URL the server builds. (TD-004 transitions
  this to an iOS-type Google client + direct on-device OAuth in
  EPIC-002.)
- **`expo-web-browser`** — `openAuthSessionAsync(url, returnUrl)` for
  the OAuth modal. Native dep.
- **`expo-crypto`** — `getRandomBytesAsync` + `digestStringAsync` for
  PKCE. Native dep.
- **`expo-secure-store`** — three `setItemAsync` calls. Native dep.

All three are stock Expo modules, installed via
`pnpm --filter @travel-planner/mobile exec expo install expo-web-browser expo-crypto expo-secure-store`
to ensure SDK 54 version pinning.

### UI / UX

- Sign-in screen: vertically centred "Sign in with Google" button on a
  neutral background. Minimum 44×44pt touch target per CONSTITUTION §8.
  Accessible name "Sign in with Google" (button label is sufficient;
  no extra `accessibilityLabel` needed).
- testIDs (Maestro-load-bearing, per `apps/mobile/AGENTS.md`'s naming
  convention `<screen>-<element>`):
  - Root view: `login-screen-root`.
  - Sign-in button: `login-google-button`.
  - Inline error text: `login-screen-error` (appears only in the
    `error` state; carries the user-visible copy).
  - Closed-auth copy: same `login-screen-error` testID — Maestro can
    assert on the visible text to differentiate `access_denied` from
    generic.
- In-flight: button disabled (greyed) with a spinner adjacent. The
  modal browser covers the screen for the bulk of this state.
- Error states render below the button, screen-reader-visible.
- Placeholder `/signed-in` screen: large text "Signed in as
  `<email>`." centred. Trivially accessible.
- Colour usage: stays on the default Expo neutral palette. Slice 7
  introduces real branding.
- Responsive layout: single-column, intrinsic mobile-only (web's
  three-viewport rule from ADR 007 doesn't apply to the RN app).

## 8. Security & data considerations

**Threats considered:**

- **Token leakage via logs.** `console.log(accessToken)` or its kin
  would expose a 15m-valid bearer. Mitigation: `apiClient.ts` never
  logs the `Authorization` header value; `sign-in-flow.ts` never
  logs the `verifier`, `code`, `access_token`, or `refresh_token`.
  The error UX displays only the API error `code` field, never
  the underlying response body.
- **PKCE verifier in-memory.** The verifier lives in a closure inside
  `runSignInFlow`; it's garbage-collected when the flow completes.
  Acceptable per OAuth 2.0 PKCE RFC 7636.
- **Deep-link `code` value visibility.** The one-time code arrives in
  the URL query string; `openAuthSessionAsync` returns it to the app
  process directly (no system-wide notification or Universal Link
  log). iOS Custom Schemes are observable only by the app that
  registered them. Mitigated by the one-time-use + 120s TTL ADR 054
  policy.
- **Keychain compromise.** `expo-secure-store` uses iOS Keychain
  Services with `kSecAttrAccessibleAfterFirstUnlock` by default —
  encrypted at rest, only readable after device unlock. No app-side
  improvement needed.
- **Network MITM on dev.** `EXPO_PUBLIC_API_BASE_URL=http://...` is
  plaintext HTTP for LAN dev. Acceptable for the audience of two;
  prod will be HTTPS once EPIC-002 provisions the hostname.
- **Closed-auth bypass.** A new user can sign in to Google
  successfully but `/callback` redirects with `?error=access_denied`
  per ADR 029. The mobile app surfaces this and writes no tokens —
  closed-auth invariant holds.
- **PII in error logs.** The two-bucket error UX surfaces only the
  error `code` (snake_case ASCII enum value). No email, no token, no
  Google profile fields. Safe for `console.warn` and (slice 9) Sentry.

**Mitigations beyond the above:**

- All Keychain writes happen ONLY after `/me` returns 200 — no
  partial state on a half-failed flow.
- All Keychain reads in slice 7 will validate the wire shape via the
  shared schemas; if Keychain ever holds garbage (from an old
  abandoned flow or a partially-deleted state), the read parses fail
  loud.
- `apiClient.ts`'s defensive fallback for malformed error envelopes
  (`{ code: 'internal', ... }`) ensures a server bug producing a
  non-envelope response doesn't crash the mobile app.

**Secrets needed:** none new server-side. Client-side `EXPO_PUBLIC_API_BASE_URL`
is non-secret (it's a hostname).

## 9. Test plan

Tests written **before** implementation per CONSTITUTION.md §3.

### E2E (Maestro)

| Test file | What it covers |
|---|---|
| `apps/mobile/.maestro/flows/sign-in.yaml` | New. App launches → sign-in screen renders with `login-google-button` testID → tap button → observable in-flight transition (spinner appears OR modal-open side effect). Stops short of driving real OAuth — Google's anti-automation rejects scripted credentials. |
| `apps/mobile/.maestro/flows/launch.yaml` | Existing (SPEC-003). Verifies the post-rewrite sign-in screen still passes its launch assertion (root testID may shift from `hello-screen-root` to `login-screen-root`; flow updated to match). |

### Integration (Vitest + Testcontainers, web side)

| Test file | What it covers |
|---|---|
| All SPEC-001/002/004/005 web-side `.int-test.ts` files | Stay green unchanged. Slice 6 is mobile-side; no web-side server changes. The `.parse()` drift guards from SPEC-005 continue to act as the wire-shape contract. |

### Unit (Jest + RNTL + msw, mobile side)

| Test file | What it covers |
|---|---|
| `apps/mobile/__tests__/auth/pkce.test.ts` | New. `generateVerifier()` returns a 43-char base64url string; multiple calls return different values; `verifierToChallenge(verifier)` returns a stable 43-char base64url hash for a fixed verifier (regression against a hand-computed fixture). |
| `apps/mobile/__tests__/auth/sign-in-flow.test.ts` | New. Four branches with all four boundary deps mocked: (a) full happy path → returns `{ status: 'success', email: 'matt@example.com' }` and `storeTokens` is called exactly once with the exchange response; (b) modal returns `type: 'cancel'` → returns `{ status: 'cancelled' }` and `storeTokens` is NOT called; (c) deep link carries `?error=access_denied` → returns `{ status: 'error', reason: 'access_denied', code: 'access_denied' }` and `storeTokens` is NOT called; (d) `/exchange` returns 400 `pkce_mismatch` → returns `{ status: 'error', reason: 'generic', code: 'pkce_mismatch' }` and `storeTokens` is NOT called; (e) `/me` returns 401 after a successful `/exchange` → `storeTokens` is NOT called (the "no partial state" invariant). |
| `apps/mobile/__tests__/api/client.test.ts` | New. msw/native handlers return canned responses. (a) `apiPost` parses a 200 body via the shared schema; (b) `apiPost` parses a 400 envelope via `apiErrorBodySchema`; (c) `apiPost` falls back to `{ code: 'internal' }` when the error body doesn't match the envelope; (d) `apiPost` returns `{ code: 'internal', message: 'Network unreachable.' }` when fetch rejects. |
| `apps/mobile/__tests__/app/index.test.tsx` | Rewritten. Mocks `runSignInFlow` to return each of the four result variants. Asserts: button renders with `login-google-button` testID; idle state; in-flight spinner during pending flow; on success → `router.replace` called with the right href; on cancel → returns to idle silently; on `access_denied` → closed-auth copy renders; on generic error → fallback copy + `[code: <code>]` tag renders. |
| `apps/mobile/__tests__/app/signed-in.test.tsx` | New. Renders with `email=matt@example.com` route param; the screen text contains "Signed in as matt@example.com." and the `signed-in-screen-email` testID. |
| `apps/mobile/__tests__/shared.test.ts` | Unchanged (SPEC-005 smoke test). |

### Manual checks

- **On-device sign-in dry run.** Author runs `EXPO_PUBLIC_API_BASE_URL=...
  pnpm dev:mobile`, scans the QR on the iPhone, taps Sign in with
  Google, completes Google OAuth, observes navigation to the
  `/signed-in` placeholder with the correct email. Then force-quits
  and reopens to confirm the strict-cold-start expectation (sign-in
  screen renders again).
- **Closed-auth dry run.** Author signs in with a non-approved Google
  account (e.g. a personal alias not added to the `users` table).
  Observes `access_denied` copy. No Keychain write.
- **Cancellation dry run.** Author taps Sign in with Google, dismisses
  the OAuth modal mid-flow. Observes the app returning to idle
  silently.
- **Keychain inspection** (optional, dev-only). Use Xcode's
  device-window Keychain inspector or `expo-secure-store` debug
  logging (added behind a `__DEV__` flag in `keychain.ts` if
  helpful) to confirm three keys land after a successful sign-in.
  Remove any debug logging before the final commit.

## 10. Observability

- **Logs.** `console.warn` on every non-success branch of
  `runSignInFlow` with the `code` value only (never tokens or
  email). Format:
  `[auth] sign-in failed code=<code> reason=<access_denied|generic>`.
- **Metrics.** No new metrics in slice 6.
- **Sentry / error reporting.** Slice 9. Slice 6's `console.warn`
  calls are deliberately Sentry-shape-compatible (level + tags +
  extra) so slice 9 can wrap them with `Sentry.captureMessage`
  without restructuring the call sites.

## 11. Rollback / safety

- **Web side untouched.** No DB changes, no server-side code changes.
  Roll-back is `git revert` of the slice's commits; web behaviour
  remains identical to today's `main`.
- **Mobile-side roll-back.** Reverting the commit set means scanning
  the prior Expo Go bundle (SDK 54 Hello screen). Existing Keychain
  entries from a partial sign-in are orphaned but harmless
  (per-app namespace, no global impact). If a user wants to clear
  them: reinstall Expo Go or call `expo-secure-store.deleteItemAsync`
  manually in a future build.
- **CI roll-back.** If the new `mobile-e2e` job is flaky in its first
  week, two escape valves: (i) mark the job non-blocking via the
  workflow's `continue-on-error` setting; (ii) revert just the
  `.github/workflows/ci.yml` portion of the slice while keeping the
  Maestro flow + dev-client wiring scripts. The flow file then runs
  on `pnpm test:e2e:mobile` locally until the CI
  flake is fixed. Decide at SPEC time which fallback (i)/(ii) is the
  default — recommendation: **(i) non-blocking for the first week,
  then promote**. Captured in §14 risks.
- **No tokens, no migrations to revert.**

## 12. Implementation order

Each step pairs intent with verification and is small enough to
commit on its own. Tests-first per CONSTITUTION.md §3. Approximate
day-1 / day-2 / day-3 / day-4 / day-5 chunking is annotated for
budget tracking.

1. [ ] **Intent:** Add `expo-web-browser`, `expo-crypto`,
   `expo-secure-store` to `apps/mobile/` via
   `pnpm --filter @travel-planner/mobile exec expo install expo-web-browser expo-crypto expo-secure-store`.
   **Verification:** `pnpm install` clean; `pnpm --filter @travel-planner/mobile type-check`
   exits 0; the three packages appear in `apps/mobile/package.json`
   dependencies. (Day 1 morning.)

2. [ ] **Intent:** Create `apps/mobile/src/auth/pkce.ts` + its Jest
   test (`__tests__/auth/pkce.test.ts`) covering verifier length /
   uniqueness and challenge stability. **Verification:**
   `pnpm --filter @travel-planner/mobile test` passes (3 → 6 tests).
   (Day 1 morning.)

3. [ ] **Intent:** Create `apps/mobile/src/auth/keychain.ts` (only
   `storeTokens` + `clearTokens` — no read in slice 6) + its Jest
   test mocking `expo-secure-store` and asserting all three keys are
   written. **Verification:** Jest passes (now 8 tests). (Day 1
   afternoon.)

4. [ ] **Intent:** Create `apps/mobile/src/api/client.ts` (apiPost +
   apiGet) + `__tests__/api/client.test.ts` using msw/native handlers
   for the four test scenarios (200 happy, 400 envelope, malformed
   error body, network reject). **Verification:** Jest passes
   (~12 tests). (Day 1 afternoon / Day 2 morning.)

5. [ ] **Intent:** Create `apps/mobile/src/auth/sign-in-flow.ts`
   (the orchestrator, with `SignInDeps` injected for testability) +
   `__tests__/auth/sign-in-flow.test.ts` covering the five branches
   in §9 (happy, cancel, access_denied, generic /exchange error, /me
   failure → no persist). **Verification:** Jest passes (~17 tests).
   (Day 2.)

6. [ ] **Intent:** Rewrite `apps/mobile/app/index.tsx` as the sign-in
   screen with the 3-state local discriminant; wire up
   `runSignInFlow` with the real deps. Rewrite the existing
   `__tests__/app/index.test.tsx` to mock the flow and assert all
   four UI branches + the navigation call. Update the existing
   `launch.yaml` Maestro flow's selectors to the new screen's
   testIDs. **Verification:** Jest passes; `pnpm test:e2e:mobile`
   (against simulator) shows `launch.yaml` green. (Day 3.)

7. [ ] **Intent:** Create `apps/mobile/app/signed-in.tsx` placeholder
   + `__tests__/app/signed-in.test.tsx`. **Verification:** Jest
   passes. (Day 3 afternoon.)

8. [ ] **Intent:** Create `apps/mobile/.maestro/flows/sign-in.yaml`
   asserting launch → sign-in screen → tap button → observable
   in-flight state. **Verification:**
   `pnpm test:e2e:mobile` runs both flows green
   locally. (Day 3 afternoon.)

9. [ ] **Intent:** Pay down TD-002 — replace the placeholder
   `mobile-e2e` job in `.github/workflows/ci.yml` with the real
   pipeline defined by ADR 055:
   - `pnpm --filter @travel-planner/mobile exec expo prebuild --platform ios --clean`
     to generate `ios/`.
   - `pnpm --filter @travel-planner/mobile exec eas build --local --profile development --platform ios --non-interactive`
     to produce a dev-client `.app`.
   - `xcrun simctl boot "iPhone 15"` (or the current SDK 54-compatible
     simulator name).
   - `xcrun simctl install booted <artifact>.app`.
   - `pnpm test:e2e:mobile` (which runs `maestro test .maestro/flows`).
   - Upload Maestro's HTML report as a CI artifact on failure
     (7-day retention).
   - **Caching:** skip in the first iteration — ship without
     `~/Library/Caches/expo-prebuild` caching. Re-evaluate after
     5 runs; if average build time exceeds 10 minutes, add caching
     as a follow-up.
   Mark the job `continue-on-error: true` for week 1 (per §11
   rollback escape valve); set a calendar reminder to promote it to
   blocking. **Verification:** Open a no-op `apps/mobile/**`-touching
   PR; CI job runs end-to-end with green Maestro logs. (Day 4.)

10. [ ] **Intent:** `apps/mobile/AGENTS.md` updates — add the
    "Sign-in flow" subsection covering `apps/mobile/src/auth/` +
    `apps/mobile/src/api/` conventions; "Dev loop" gains the
    `EXPO_PUBLIC_API_BASE_URL=http://<lan-ip>:3000` workflow note;
    "Prerequisites for future slices" — partner-device check stays
    deferred to EPIC-002 per §13 Q1. **Verification:** Reads
    cleanly; `pnpm lint` exits 0. (Day 4.)

11. [ ] **Intent:** TD-002 entry update — at slice close-out, move
    TD-002 to the Resolved table of `docs/tech-debt.md`, noting
    SPEC-006 as the resolution. **Verification:** docs-only;
    `pnpm lint` exits 0. (Day 5.)

12. [ ] **Intent:** Update EPIC-001 §7 slice 6 row to `Done` +
    append the close-out row to the slice ledger. Update
    `docs/specs/README.md` index. **Verification:** docs-only;
    `pnpm lint` exits 0. (Day 5.)

13. [ ] **Intent:** Final full verification suite.
    **Verification:** From repo root: `pnpm lint &&
    pnpm db:check:migrations && pnpm type-check && pnpm test:unit &&
    pnpm test:integration` all exit 0; `pnpm build` exits 0;
    `pnpm test:e2e:mobile` exits 0; manual
    on-device sign-in dry-run plus closed-auth dry-run plus
    cancellation dry-run all pass per §9. (Day 5.)

## 13. ADR triggers and tech-debt review

### ADR?

- [x] **New library, external tool, or vendor** — three new Expo
      modules (`expo-web-browser`, `expo-crypto`, `expo-secure-store`).
      Each is a stock Expo first-party module specifically called out
      by EPIC-001 §10's "Mobile auth model" row (PKCE + Keychain via
      `expo-secure-store`). No new ADR — the framework-level decision
      is settled by the epic; adding the modules is the implementation
      of that decision.
- [x] **CI pipeline or workflow structural change** — `mobile-e2e`
      job goes from placeholder to real EAS-Local-built dev-client +
      Maestro test execution. **Yes** — the EAS-Local-in-CI pattern
      is reusable for future mobile slices (slice 7's "me" screen,
      slice 9's observability) and worth documenting once.
      **[ADR 055 — Mobile E2E via EAS Local Dev-Client Build in
      CI](../decisions/055-mobile-e2e-via-eas-local-dev-client-in-ci.md)**
      drafted alongside the SPEC.
- [ ] **New project-wide standard** — N/A; mobile-only conventions
      live in `apps/mobile/AGENTS.md`.
- [x] **Non-obvious architectural trade-off** — strict-cold-start
      (slice 6 doesn't read Keychain on launch) is a deliberate
      slice-boundary choice that splits responsibilities between
      slice 6 and slice 7. Captured in this spec's §5 and §7; doesn't
      warrant a standalone ADR — slice-level not epic-level.
- [ ] **Cross-cutting decision not already settled by the parent
      epic** — N/A; all cross-cutting decisions inherited.

**ADRs to write:** None outstanding. [ADR 055](../decisions/055-mobile-e2e-via-eas-local-dev-client-in-ci.md)
is drafted alongside this SPEC and lands in the same planning commit.
It records the build pipeline shape (`expo prebuild` + `eas build
--local` + simulator install + Maestro), the ~$0.40–0.80
macOS-minutes-per-run cost band, the "non-blocking during week 1,
promote to blocking" stance, and the trigger to revisit (EPIC-002's
switch to EAS Build / TestFlight).

### Tech debt

- [x] I reviewed `docs/tech-debt.md`:
  - **TD-002** — paid down by step 9 of §12; moved to Resolved at
    close-out (step 11).
  - **TD-003** — Expo SDK 54 downgrade. Stays open; slice 6 builds on
    SDK 54. Re-upgrade trigger unchanged.
  - **TD-004** — direct on-device OAuth via `expo-auth-session` +
    iOS-type Google client. Stays open; slice 6 keeps server-mediated
    PKCE. Trigger unchanged: EPIC-002 / ADP funded.
  - **TD-005** — dev-only dependabot transitives. Unaffected.

**Tech debt items addressed by this spec:** TD-002 (Resolved).

## 14. Risks & open questions

- **`expo prebuild` + EAS Local in CI is first-of-kind.** The mobile
  CI job has never run a real build before; macOS runner caching,
  signing-cert requirements for dev clients, headless-simulator
  reliability are all unknowns. Mitigation: §11 rollback option (i)
  — `continue-on-error: true` for week 1, promote to blocking once
  stable. Set a calendar reminder. If the build refuses to complete
  in <15min under any configuration, drop back to TD-002-still-open
  + Maestro-local-only and re-plan via a follow-up spec.
- **LAN-IP-based `EXPO_PUBLIC_API_BASE_URL` on iPhone dev.** Works on
  home / office networks. Captive portals (coffee shops, hotels)
  block LAN traffic. Acceptable for the audience-of-two; document
  the workflow.
- **`SFAuthenticationSession` first-launch UX.** iOS shows a
  per-app "this app wants to use Google to sign in" warning the
  first time. Mistakable for a bug if not flagged in the demo
  walkthrough — note in §4 demo step 4.
- **`/exchange` succeeds, `/me` fails.** Treated as a generic-error
  branch with no token persistence. If this fires in practice it
  indicates a server-side signing-key drift between
  `signAccessToken` and `verifyAccessToken` — investigate immediately,
  not a slice-6 bug per se.
- **`expo-secure-store` simulator vs device.** Simulator Keychain
  is per-instance and can be wiped by Xcode tooling; device
  Keychain persists. Manual verification needs to cover both.
- **`pnpm install` adding three `expo-*` deps may shift the
  lockfile widely.** Watch the diff at step 1. If surprising
  transitive bumps land, halt and consult.
- **`apps/mobile/src/` is a new convention.** SPEC-003 / ADR 052
  didn't pre-empt this directory. The choice of `src/` over
  `lib/` / `modules/` matches `apps/web/src/` precedent and is
  documented in `apps/mobile/AGENTS.md` updates (step 10). Worth
  human review at SPEC time.
- **`launch.yaml` testID rewrite.** The existing flow asserts on
  `hello-screen-root`; rewriting the entry screen breaks this.
  Step 6 updates the flow to the new screen's testID
  (`login-screen-root`, matching the existing `hello-screen-root` /
  `me-screen-*` naming pattern from SPEC-003 and `apps/mobile/AGENTS.md`).
  Risk: the flow update lands in step 6 alongside the screen rewrite —
  easy to forget. Mitigate by checking `launch.yaml` after the rewrite
  before moving to step 7.

---

## Implementation Deviations

> **Instruction to implementing agent:** During implementation, capture
> deviations and observations as they happen in
> `docs/implementation-notes/SPEC-006-mobile-sign-in-pkce-keychain.md`
> (rolling log). At close-out, triage that log and populate this table
> with anything that changed the design intent vs. this approved spec.

| # | Deviation | Reason | Impact | Resolved? |
|---|-----------|--------|--------|-----------|
| 1 | **CI dev-client build switched from `eas build --local --profile development` (ADR-055 draft) to raw `xcodebuild`.** Same five-stage pipeline (prebuild → cocoapods → build → simulator install → maestro) but the build step uses Apple's toolchain directly instead of EAS Local. | `eas build --local` requires `extra.eas.projectId` in `app.json` plus an EAS CLI session — either real EAS auth or a fictitious-UUID hack. The EAS CLI is also a third-party tool we'd otherwise not depend on. Raw `xcodebuild` uses CocoaPods + Xcode + iOS Simulator which are preinstalled on `macos-latest` runners — zero external account, zero new devDeps. Matches the durable-bias directive in `AGENTS.md`. | None on §3 acceptance criteria — AC#12 still passes ("`mobile-e2e` runs Maestro for real on every PR"). ADR-055 amended in-place (title + Decision §5) to describe the chosen approach; filename unchanged to preserve cross-references. The `continue-on-error: true` stance from §11 still applies for week 1. | Yes — landed in commit 99473f3 (CI yaml + ADR-055 amendment). |
| 2 | **HTTP mocking in mobile tests uses `jest.spyOn(globalThis, 'fetch')` instead of msw.** SPEC-006 §7 inherited "msw/native" from SPEC-003's anticipatory note; the actual `apps/mobile/__tests__/api/client.test.ts` + `sign-in-flow.test.ts` use a fetch spy with canned `Response` objects. | msw 2.x ships ESM-only transitive deps (`rettime`, `until-async`, `outvariant`, `@bundled-es-modules/*`, `headers-polyfill`, `is-node-process`) that jest-expo 54's inherited `transformIgnorePatterns` excludes from transformation. Making msw work needs ~10+ lines of jest config plus `moduleNameMapper` entries and ongoing maintenance as msw's transitive graph shifts. The fetch-spy has zero third-party surface area, no transform config, no ESM gotchas across RN upgrades. Durable-bias directive (`AGENTS.md`) applied. | `apps/mobile/__mocks__/` directory not created (and the `msw-server.ts` stub from this slice's first attempt was deleted). `apps/mobile/AGENTS.md` "API mocking" section rewritten to describe the fetch-spy pattern with a worked example. `msw` stays in `apps/mobile/devDependencies` (harmless; reactivate when a future spec finds a compelling case). All §3 acceptance criteria still pass — the test plan in §9 was carried out via the fetch-spy instead. | Yes — landed in commit a06ebd0 (step 4). |

### Post-Implementation Notes

**Side-quest fixes (two pre-existing SPEC-003 bugs caught en route to
step 4).** While wiring the apiClient tests:

- `jest.config.js` had `setupFilesAfterEach: ['<rootDir>/jest.setup.ts']`.
  Every jest run since SPEC-003 had been emitting a validation
  warning ("Unknown option `setupFilesAfterEach`") because the canonical
  name is `setupFilesAfterEnv` (cross-referenced against
  `jest-config@29.7.0/build/ValidConfig.js`). One-character rename.
- `jest.setup.ts` imported `'@testing-library/react-native/extend-expect'`,
  which doesn't exist in RNTL v13 — the canonical subpath is
  `'/matchers'`. The broken import was masked by the
  `setupFilesAfterEach` typo above (jest silently skipped the whole
  setup file). Fixed once the typo was, and matchers now actually
  extend `expect`.

Both fixes landed in commit `a06ebd0` (step 4) without changing slice
6's design intent. Future contributors should not see those validation
warnings any more.

**Step-ordering swap during execution.** §12 listed step 6
(`app/index.tsx` rewrite) before step 7 (`app/signed-in.tsx`
placeholder). Executed in 7→6 order because `app.json`'s
`experiments.typedRoutes: true` infers the valid route union from the
`app/` directory contents — step 6's `router.replace({ pathname:
'/signed-in', … })` wouldn't type-check until `signed-in.tsx`
existed. Bundled as one commit (`1eedd5b`). No design intent change;
flagged purely so future readers don't wonder why the file timeline
doesn't match §12.

**Durable-bias directive (codified in `AGENTS.md` "Decision-making
bias") drove two real choices in this slice.** Slice planning Q10
(TD-002 pay-down inside the slice instead of deferring further) was
the direct trigger for the directive. Then in execution: (a) the
msw → fetch-spy choice in step 4, (b) the EAS Local → raw
xcodebuild choice in step 9. Both consciously picked the option
with less third-party surface area / fewer external-account
dependencies even when the more popular tool was "more nominally
correct." The companion
`feedback_prefer_durable_over_expedient.md` memory captures the
framing for future sessions.

**ADR-055 was drafted alongside SPEC-006 planning (per the
`review-spec` Warning resolution) but its build-step Decision was
amended at step 9 implementation time** when the chosen approach
diverged. The amend-the-ADR-in-place pattern (filename unchanged,
title + Decision §5 rewritten) preserves existing cross-references
without inventing a "superseded by" anchor for a one-section pivot.
A future ADR may rebadge if the build approach changes
fundamentally; for incremental drift, in-place amend + an
implementation-notes deviation entry is the right scale.

**`continue-on-error: true` on `mobile-e2e` is week-1 only — needs
a calendar gate to promote to blocking.** The first real run of
the EAS-less build pipeline might fail on any of: Xcode-version
drift on the `macos-latest` image, scheme name auto-derivation,
simulator-boot timing, CocoaPods version mismatches. Letting it
run non-blocking for a week and watching the PR signals is the
right call. Promote to blocking once a few green runs accumulate
— captured as a separate follow-up task outside this spec (not
tech debt because it's operational tuning, not a design issue).

**Code-on-disk under `apps/mobile/` after slice 6.** Three new
directories — `src/auth/` (3 modules), `src/api/` (1 module),
`__tests__/auth/` + `__tests__/api/` + `__tests__/app/` (new
`signed-in.test.tsx`); two route files rewritten/added —
`app/index.tsx` (rewrite of HelloScreen), `app/signed-in.tsx`
(new); one Maestro flow added (`.maestro/flows/sign-in.yaml`) +
the existing `launch.yaml` re-pointed at the new
login-screen-root testID; one CI workflow rewritten (the
`mobile-e2e` job). Total mobile test count went from 5 (slice 5)
→ 46 (slice 6). Web-side tests stayed green throughout (49 / 410
unit + 54 / 275 integration).

**Commit count: 13 implementation commits matching the 13 spec
steps, plus a `docs(agents)` durable-bias commit, a
`docs(spec-006)` planning commit, a `chore(scripts)` `test:e2e`
umbrella rename, and three small rebases over remote main
(dependabot release-please + a small ADR-053 mobile platform
restriction landed mid-flight).
