# SPEC-007: Mobile Authenticated "Me" Screen + Sign-Out

**Date:** 2026-05-22
**Status:** Complete
**Author:** Matt Carr (with Claude Opus 4.7 via `plan-feature` + `grill-me`)
**Approved by:** Matt Carr, 2026-05-22 (after `review-spec` pass + in-place patches)
**Completed:** 2026-05-22
**Parent epic:** [EPIC-001 — iOS App](../epics/EPIC-001-ios-app.md) — slice 7 (milestone)

---

## 1. Summary

The milestone slice of EPIC-001. After a signed-in user launches the
mobile app, the native splash holds briefly, then the home screen
renders **"Hello, {name}"** with the user's email below and a working
**Sign out** affordance. Closing the app and reopening it lands the
user back on the home screen without re-authenticating; tapping
**Sign out** revokes the refresh-token chain server-side, clears the
iOS Keychain, and returns to the sign-in screen.

Delivering this requires the auth machinery slice 6 deliberately left
open:

1. **Server-side**: a new `POST /api/v1/auth/mobile/revoke` endpoint
   + use case + wire shape that marks the presented (active head)
   refresh-token row as `revoked_at = now`. Predecessor rows in the
   same chain are not touched at sign-out time — they already carry
   `replaced_by_id`, so any later attempt to reuse them fires the
   existing reuse-detection path (ADR 054) and revokes the rest of
   the chain. The schema already supports revocation
   (`refresh_tokens.revoked_at` + the
   `RefreshTokenRepository.revokeChain` method exist from SPEC-004).
2. **Mobile**: `apps/mobile/src/auth/get-access-token.ts` (proactive
   refresh, 60s buffer, single-flight mutex); `auth-context.tsx`
   (React Context with three states: `unknown | signed_out |
   signed_in`); `keychain.ts` gains `readTokens()`; `sign-in-flow.ts`
   is reshaped to return tokens only (no more `/me` proof inside the
   flow); routes restructure into `app/(auth)/sign-in.tsx` +
   `app/(app)/index.tsx` using Expo Router's canonical auth-guard
   pattern; `expo-splash-screen` is held until the cold-start auth
   check resolves.

Cross-app impact: this slice introduces one new `/api/v1/*`
endpoint (`/auth/mobile/revoke`) consumed only by the mobile app.

With slice 7 done, EPIC-001 §3's definition-of-done is met.

## 2. Motivation

EPIC-001 §7 slice 7 — the milestone slice. Per the SPEC-006 close-out
note in the epic ledger (2026-05-21): "Slice 7 (the 'Hello, name'
milestone) is now the only thing left between EPIC-001 and its
definition-of-done."

Inherited from EPIC-001 §10 (not re-litigated):

- **Mobile framework**: Expo + Expo Router on SDK 54 (per ADR 053).
- **Mobile auth model**: PKCE + 15m HS256 access tokens + 30d opaque
  rotating refresh tokens with reuse detection. iOS Keychain via
  `expo-secure-store`.
- **API transport**: plain Route Handlers; cookie OR bearer resolves
  to the same `User`.
- **Shared types**: `@travel-planner/shared` is the wire-shape source
  of truth.
- **Mobile test runner**: Jest (`jest-expo` preset) + RNTL +
  `jest.spyOn(fetch)` for HTTP (SPEC-006 deviation #2).
- **Mobile E2E**: Maestro YAML on iOS Simulator, path-filtered macOS
  CI job (slice 6 / ADR 055).
- **Rate limiting**: `/api/v1/auth/mobile/*` endpoints (including the
  new `/revoke`) use the sliding-window Postgres rate-limit policy
  from ADR 054.

Slice-altitude decisions resolved in the `grill-me` pass; full Q→A
trail in `docs/specs/_draft-007-mobile-authenticated-me-and-signout.md`.
Load-bearing decisions:

- **Server-side `/revoke` endpoint** (Q1) — durable-bias choice over
  local-only Keychain clear. Schema already supports it.
- **Expo Router route groups `(auth)` / `(app)`** (Q2) — canonical
  auth-guard pattern, cleaner long-term semantics for nested
  authenticated screens in EPIC-002.
- **Proactive refresh + single-flight mutex** (Q3) — avoids the
  reuse-detection race that reactive 401-retry creates.
- **React Context for auth state** (Q4) — React stdlib, zero new
  deps; matches the durable-bias directive.
- **Greeting + email + sign-out + defensive approval banner** (Q5) —
  email always visible as identity disambiguator (author has multiple
  Google accounts); no avatar in this slice.
- **AuthProvider owns all `/me` calls** (Q7) — slice 6's
  `sign-in-flow.ts` is reshaped to return tokens only; single source
  of truth for "who is the current user."
- **All cold-start `/me` failures collapse to signed_out** (Q8) — the
  three-state machine stays clean; user accepts that a wifi blip
  during cold-start forces re-OAuth.
- **Minimal visuals** (Q9) — defer branding to a dedicated polish
  SPEC after EPIC-001 closes.

## 3. Acceptance criteria

1. Given a fresh install (no Keychain entries) and Expo Go on the
   author's iPhone, when I scan the QR code from
   `EXPO_PUBLIC_API_BASE_URL=http://<lan-ip>:3000 pnpm dev:mobile`,
   then the native splash holds for **< 1 second** (cold-start path
   with no Keychain values is a single SecureStore read), then the
   sign-in screen (`testID="login-screen-root"`) renders with the
   "Sign in with Google" button.
2. Given a previously signed-in user (valid access token in Keychain,
   `now < access_expires_at - 60s`), when I launch the app, then the
   splash holds for **< 2 seconds** (single `/me` round-trip on a
   reasonable network), then the me screen (`testID="me-screen-root"`)
   renders with `Hello, {name}` and the user's email.
3. Given a previously signed-in user with an expired access token but
   a valid refresh token, when I launch the app, then `/refresh` fires
   once (single call, regardless of how many concurrent `/me` callers
   exist), new tokens are persisted, the splash holds for
   **< 3 seconds** (one extra round-trip vs AC #2), and the me screen
   renders.
4. Given a previously signed-in user with an expired refresh token
   (or any refresh failure: `refresh_revoked`, `refresh_reused`,
   `refresh_expired`, `refresh_unknown`), when I launch the app, then
   Keychain is cleared and the sign-in screen renders.
5. Given a previously signed-in user whose `/me` call fails for any
   reason (network failure, 401, 5xx), when I launch the app, then
   Keychain is cleared and the sign-in screen renders (Q8 — all
   failures collapse to signed_out).
6. Given `name === null` in the `/me` response (next-auth profile
   without a display name), when the me screen renders, then it shows
   "Hello!" (no name interpolation) with the email still visible
   below.
7. Given `isApproved === false` in the `/me` response (defensive —
   bootstrap-admin sets `true`), when the me screen renders, then a
   small banner `Your account is pending approval.`
   (`testID="me-screen-approval-banner"`) appears between the email
   and the sign-out button.
8. Given the me screen is rendered, when I tap **Sign out**
   (`testID="me-screen-sign-out"`), then within ~100ms the app
   navigates to the sign-in screen and three things happen in
   parallel: (a) `POST /api/v1/auth/mobile/revoke` is called
   fire-and-forget with the current refresh token; (b) Keychain is
   cleared; (c) AuthContext transitions to `signed_out`.
9. Given the user signed out, when I relaunch the app, then the
   sign-in screen renders (Keychain is empty, no tokens to find).
10. Given the user signed out, when the server side is inspected,
    then the presented (active head) `refresh_tokens` row has
    `revoked_at` set to the sign-out timestamp. (Predecessor rows in
    the chain are not revoked at sign-out — they would be revoked by
    reuse-detection if any thief later attempts to use them.)
11. Given an in-progress sign-out call to `/revoke` that fails
    (network down, 5xx, validation error), when the response is
    received, then the client still successfully signs the user out
    locally — fire-and-forget never blocks the sign-out UX.
12. Given the user just completed `runSignInFlow` successfully, when
    `AuthContext.signIn(tokens)` runs, then it: stores tokens →
    calls `/me` with the new bearer → on success: transitions to
    `signed_in` with the `MeResponse`; on failure: clears tokens
    and transitions to `signed_out` (no partial state).
13. Given two concurrent callers invoke `getAccessToken()` while the
    access token is expired, when the calls resolve, then exactly
    one `/refresh` call is made and both callers receive the same
    new access token.
14. Given the new `POST /api/v1/auth/mobile/revoke` endpoint, when
    called with a valid refresh token, then the presented row is
    marked `revoked_at`, the response is `204 No Content`, and a
    repeat call with the same (now revoked) token is also `204`
    (idempotent — `revokeChain` is a no-op on already-revoked rows).
15. Given the new endpoint, when called with an unknown/malformed
    refresh token, then the response is `204` (don't leak existence
    of valid tokens; never blocks client sign-out UX).
16. Given the new endpoint, when called with a malformed body
    (missing `refresh_token` field), then the response is `400` with
    the `validation_failed` envelope.
17. Given the new endpoint, when called above the rate-limit
    thresholds (the same sliding-window policy as `start` /
    `exchange` / `refresh`), then the response is `429` with the
    `rate_limited` envelope.
18. Given a `apps/mobile/**` PR, when CI runs, then existing Maestro
    flows (`launch.yaml`, `sign-in.yaml`) still pass — slice 7 adds
    no new flow but the route-group restructure must not break the
    existing assertions.
19. Given the full verification suite at SPEC close-out, then `pnpm
    lint && pnpm db:check:migrations && pnpm type-check &&
    pnpm test:unit && pnpm test:integration` all exit 0 from the
    repo root; `POSTGRES_URL=... pnpm build` exits 0; `pnpm
    test:e2e:mobile` exits 0; all four manual on-device dry-runs
    in §9 pass.

## 4. Demo script

1. On a freshly cloned repo, `pnpm install`, then `pnpm dev`.
2. In another shell, look up the Mac's LAN IP (e.g. `192.168.1.42`),
   then run
   `EXPO_PUBLIC_API_BASE_URL=http://192.168.1.42:3000 pnpm dev:mobile`.
3. On the author's iPhone, open Expo Go and scan the QR. The Expo
   splash holds briefly, then the sign-in screen renders.
4. Tap **Sign in with Google**, complete OAuth in the system browser
   (slice 6's flow). The app returns to the placeholder area, then
   navigates to the me screen showing **"Hello, Matt"** with
   `matt@example.com` below and a **Sign out** button.
5. Force-quit the app via the iOS app switcher.
6. Reopen the app via Expo Go. The splash holds briefly, then —
   without any Google interaction — the me screen renders again
   showing **"Hello, Matt"**. (Cold-start recovery from Keychain.)
7. Manually edit the device clock forward by 20 minutes to force the
   access token past its 15-minute TTL. Force-quit and reopen.
   The splash holds slightly longer (one `/refresh` round-trip), then
   the me screen renders normally. (Proactive refresh path.)
8. Reset the device clock. On the me screen, tap **Sign out**.
   Within ~100ms the sign-in screen appears.
9. On the server, run a quick SQL inspection
   (`select id, revoked_at, replaced_by_id from refresh_tokens
   where user_id = '<author>' order by created_at desc limit 5;`).
   The most recent row (active head before sign-out) has
   `revoked_at` populated. Predecessor rows still have their
   `replaced_by_id` set but `revoked_at` may be null — that's
   expected; reuse-detection covers them.
10. Reopen the app via Expo Go. Sign-in screen renders again
    (Keychain empty).
11. Open a PR touching `apps/mobile/` and watch CI: `mobile-e2e`
    runs `launch.yaml` + `sign-in.yaml` against the restructured
    routes; both pass.

## 5. Out of scope

Inherited from EPIC-001 §6 / §10:

- No App Store / TestFlight / EAS Build signed builds / APNs /
  Android.
- No tRPC / ts-rest / GraphQL.
- No Server Action replacement on web.
- No offline mode (explicit EPIC §6 non-goal).
- No mobile Sentry (slice 9).

Specific to this slice (settled in grilling):

- **Custom branding** (palette, font, icon, splash imagery). Defer
  to a dedicated polish SPEC. Slice 7 stays on Expo neutral
  palette + system fonts. (Q9.)
- **Avatar on me screen.** Would require extending `/me` with
  `image`, plumbing through next-auth adapter, image-loading states.
  Future profile slice. (Q5.)
- **"Boot error" UI for transient `/me` failures.** All failures
  collapse to `signed_out`. Three-state machine. Audience accepts
  the wifi-blip trade-off. (Q8.)
- **Cached `MeResponse` for offline render.** EPIC §6 non-goal. (Q8.)
- **`/me` re-fetch on app foreground / window focus.** Slice 7 calls
  `/me` once on cold-start and once on sign-in. No focus-refetch
  hook.
- **`me-screen.yaml` Maestro flow.** The me screen lives behind
  slice 6's Google-OAuth barrier; Maestro can't drive it.
  Adding the YAML would just re-assert what `launch.yaml` already
  covers. Defer until EPIC-002 provides a Keychain-seedable test
  build. (Q6.)
- **TD-004 transition to `expo-auth-session` + iOS-type Google
  client.** Stays deferred to EPIC-002.
- **"Switch account" UI on sign-out.** Returns to sign-in only;
  multi-account stays for later.
- **Mid-session refresh integration tests beyond `get-access-token`
  unit tests.** Slice 8+ exercises mid-session refresh via real
  concurrent authenticated calls; slice 7's machinery is unit-tested
  but only the cold-start / sign-in paths actually fire it.

## 6. Prerequisites

- EPIC-001 slices 1–6 Done (SPEC-001 through SPEC-006). ✅ All Done
  as of 2026-05-21.
- `apps/mobile/` running on Expo SDK 54 with the stock Metro config
  (ADR 053). ✅ Done.
- `@travel-planner/shared` exports the wire shapes this slice
  consumes (`meResponseSchema`, `mobileAuthRefreshRequestSchema`,
  `mobileAuthRefreshResponseSchema`, `apiErrorBodySchema`, plus the
  new `mobileAuthRevokeRequestSchema` added in this slice). ✅
  Existing shapes done in SPEC-005; new one added by this SPEC.
- `apps/mobile/src/auth/{pkce,keychain,sign-in-flow}.ts` and
  `apps/mobile/src/api/client.ts` exist (slice 6 / SPEC-006). ✅
  Done.
- `refresh_tokens` table exists with `revoked_at` + `replaced_by_id`
  columns; `DrizzleRefreshTokenRepository.revokeChain(ids, date)`
  exists. ✅ Done in SPEC-004 / migration `0014_freezing_ultimates.sql`.
- Sliding-window rate-limit policy (ADR 054) applies to
  `/api/v1/auth/mobile/*`; the new `/revoke` endpoint plugs into the
  existing `rateLimitOrReject` helper. ✅ Helper exists.
- Author has previously signed in via slice 6's flow (tokens already
  in Keychain) for the cold-start dry runs.
- No new env vars. The existing `EXPO_PUBLIC_API_BASE_URL` covers
  the mobile side; server side has no new secrets.
- macOS CI runner availability for `mobile-e2e` — already configured
  via SPEC-006 / ADR 055.

## 7. Design

This slice touches two apps (web + mobile) and one shared package.
Sections below mirror that decomposition.

### 7.1 Web: new `POST /api/v1/auth/mobile/revoke` endpoint

#### Data & domain

No new tables. The `refresh_tokens` table already has
`revoked_at: timestamp with timezone (nullable)` and the
`replaced_by_id` chain pointer. Both columns from migration
`0014_freezing_ultimates.sql` (SPEC-004 / ADR 051).

#### Behaviour

**New use case** —
`apps/web/src/application/use-cases/auth/mobile/revoke-mobile-tokens.ts`:

```ts
export type RevokeMobileTokensDeps = {
  refreshTokenRepo: RefreshTokenRepository;
  crypto: MobileAuthCrypto;   // for hashing the presented refresh token
};

export type RevokeMobileTokensInput = { refreshToken: string };

export function makeRevokeMobileTokens(deps: RevokeMobileTokensDeps) {
  return async (input: RevokeMobileTokensInput, now: Date): Promise<void> => {
    const tokenHash = await deps.crypto.hashRefreshToken(input.refreshToken);
    const found = await deps.refreshTokenRepo.findByTokenHash(tokenHash);

    // Idempotent + non-revealing: unknown tokens, malformed tokens,
    // already-revoked tokens all return successfully. The endpoint
    // never tells a caller "that token isn't valid" — it just
    // promises "if you had a token, it's revoked now."
    if (!found) return;

    // Revoke the presented (active head) row only. Predecessors in
    // the chain still carry `replaced_by_id`; any attempt to reuse
    // them fires reuse-detection in /refresh's `rotate()` path and
    // revokes the rest of the chain (per ADR 054). No new
    // repository method needed.
    await deps.refreshTokenRepo.revokeChain([found.id], now);
  };
}
```

Note: `revokeChain` already accepts an array of ids and is
idempotent on already-revoked rows
(`drizzle-refresh-token-repository.ts:108-109` only updates rows
where `revoked_at IS NULL`), so the single-id call is the correct
shape for both first-revoke and repeat-revoke cases.

**New route handler** —
`apps/web/src/app/api/v1/auth/mobile/revoke/route.ts`:

```ts
import { mobileAuthRevokeRequestSchema as Body } from '@travel-planner/shared';
import { makeRevokeMobileTokens } from '@/application/use-cases/auth/mobile/revoke-mobile-tokens';
import { getAppContainer } from '@/infrastructure/container';
import { respondWithError } from '../../../_lib/errors';
import { rateLimitOrReject } from '../_lib/with-rate-limit';

export async function POST(request: Request): Promise<Response> {
  try {
    const parsed = Body.safeParse(await safeJson(request));
    if (!parsed.success) {
      return respondWithError('validation_failed', 'Invalid request body.', {
        issues: parsed.error.issues.map((i) => ({ path: i.path, message: i.message })),
      });
    }

    const container = getAppContainer();

    const rateLimit = await rateLimitOrReject({
      request,
      endpoint: 'revoke',
      repo: container.authRateLimitRepository,
    });
    if (rateLimit) return rateLimit;

    const revoke = makeRevokeMobileTokens({
      refreshTokenRepo: container.refreshTokenRepository,
      crypto: container.mobileAuthCrypto,
    });

    await revoke({ refreshToken: parsed.data.refresh_token }, new Date());

    return new Response(null, {
      status: 204,
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    console.error('[api/v1/auth/mobile/revoke] unexpected error', error);
    return respondWithError('internal', 'An unexpected error occurred.');
  }
}

async function safeJson(request: Request): Promise<unknown> {
  try { return await request.json(); }
  catch { return null; }
}
```

**Rate-limit endpoint name.** The existing `rateLimitOrReject`
helper takes `endpoint: string` (see
`apps/web/src/app/api/v1/auth/mobile/_lib/with-rate-limit.ts:24`).
The `/revoke` endpoint passes `endpoint: 'revoke'` — no type
extension needed.

#### Storage & migrations

N/A — no schema changes. Uses the existing `refresh_tokens` table
and the `revokeChain` repository method (already implemented in
SPEC-004).

#### External integrations

N/A — no Google / third-party calls. The endpoint is local DB work.

### 7.2 Shared package: new wire shape

**New file** — `packages/shared/src/mobile-auth.ts` gains:

```ts
// ---------------------------------------------------------------------------
// POST /api/v1/auth/mobile/revoke
// ---------------------------------------------------------------------------

/**
 * Body sent by the mobile client to revoke a refresh-token chain
 * (sign-out). Mirrors the /refresh shape because the operation is
 * "tell the server this refresh token's chain is dead." Server
 * marks the entire chain as `revoked_at`; subsequent /refresh
 * calls with any chain member return `refresh_revoked`.
 *
 * Response is 204 No Content on success; the operation is
 * idempotent (calling twice with the same token is also 204).
 * The server intentionally returns 204 for unknown/malformed
 * tokens too — the endpoint promises "if you had a chain, it's
 * revoked now," not "this token was valid."
 */
export const mobileAuthRevokeRequestSchema = z.object({
  refresh_token: z.string().min(1),
});
export type MobileAuthRevokeRequest = z.infer<typeof mobileAuthRevokeRequestSchema>;
```

`packages/shared/src/index.ts` re-exports the new schema + type.

### 7.3 Mobile: auth machinery + me screen

#### Layer layout (after slice 7)

```
apps/mobile/
├── app/
│   ├── _layout.tsx              (rewritten: SplashScreen.preventAutoHideAsync + AuthProvider + AuthGuard + Stack)
│   ├── (auth)/
│   │   ├── _layout.tsx          (new: Stack screen options)
│   │   └── sign-in.tsx          (moved from app/index.tsx via git mv)
│   └── (app)/
│       ├── _layout.tsx          (new: Stack screen options)
│       └── index.tsx            (rewritten from app/signed-in.tsx — me screen; renders null while auth.status === 'unknown')
├── src/
│   ├── auth/
│   │   ├── pkce.ts              (unchanged)
│   │   ├── keychain.ts          (+ readTokens export)
│   │   ├── sign-in-flow.ts      (reshape: returns tokens only)
│   │   ├── get-access-token.ts  (new — proactive refresh + single-flight)
│   │   └── auth-context.tsx     (new — React Context)
│   └── api/
│       └── client.ts            (unchanged)
├── __tests__/
│   ├── app/
│   │   ├── (auth)/
│   │   │   └── sign-in.test.tsx (moved + adjusted nav target)
│   │   └── (app)/
│   │       └── index.test.tsx   (new — me screen 4 variants, including the `unknown` null-render)
│   ├── auth/
│   │   ├── pkce.test.ts            (unchanged)
│   │   ├── keychain.test.ts        (+ readTokens cases)
│   │   ├── sign-in-flow.test.ts    (reduced: drop /me-as-proof branches)
│   │   ├── get-access-token.test.ts (new)
│   │   └── auth-context.test.tsx   (new)
│   ├── api/
│   │   └── client.test.ts       (unchanged)
│   └── shared.test.ts           (unchanged)
└── .maestro/
    └── flows/
        ├── launch.yaml          (unchanged — still asserts sign-in screen on no-Keychain CI)
        └── sign-in.yaml         (unchanged)
```

**Deleted:** `apps/mobile/app/signed-in.tsx` (the slice-6
placeholder) and `apps/mobile/__tests__/app/signed-in.test.tsx`.
The current `apps/mobile/app/index.tsx` (slice-6 sign-in screen)
moves to `apps/mobile/app/(auth)/sign-in.tsx` via `git mv` and
does **not** leave behind a bare `app/index.tsx` — under Expo
Router, a bare `app/index.tsx` would collide with
`app/(app)/index.tsx` (route groups add zero URL segments, so both
resolve to `/`).

#### Data & types (mobile-internal)

```ts
// apps/mobile/src/auth/auth-context.tsx
export type AuthState =
  | { status: 'unknown' }
  | { status: 'signed_out' }
  | { status: 'signed_in'; me: MeResponse };

export type AuthContextValue = AuthState & {
  signIn: (tokens: MobileAuthExchangeResponse) => Promise<void>;
  signOut: () => Promise<void>;
};

// apps/mobile/src/auth/get-access-token.ts
export type AccessTokenResult =
  | { ok: true; token: string }
  | { ok: false; reason: 'no_tokens' | 'refresh_failed' };
```

#### Behaviour

**`apps/mobile/src/auth/keychain.ts`** — add `readTokens`:

```ts
export type StoredTokens = MobileAuthExchangeResponse;

export async function readTokens(): Promise<StoredTokens | null> {
  const [access_token, refresh_token, access_expires_at] = await Promise.all([
    SecureStore.getItemAsync(ACCESS_TOKEN_KEY),
    SecureStore.getItemAsync(REFRESH_TOKEN_KEY),
    SecureStore.getItemAsync(ACCESS_EXPIRES_AT_KEY),
  ]);
  if (!access_token || !refresh_token || !access_expires_at) return null;
  return { access_token, refresh_token, access_expires_at };
}
```

Defensive: any one key missing → return `null` (partial state from
an interrupted earlier flow is treated as no-state).

**`apps/mobile/src/auth/get-access-token.ts`** — new file:

```ts
const REFRESH_BUFFER_MS = 60_000; // refresh if token has < 60s of life

let inFlightRefresh: Promise<AccessTokenResult> | null = null;

export async function getAccessToken(): Promise<AccessTokenResult> {
  const tokens = await readTokens();
  if (!tokens) return { ok: false, reason: 'no_tokens' };

  const expiresAt = new Date(tokens.access_expires_at).getTime();
  if (Date.now() < expiresAt - REFRESH_BUFFER_MS) {
    return { ok: true, token: tokens.access_token };
  }

  if (!inFlightRefresh) {
    inFlightRefresh = doRefresh(tokens.refresh_token).finally(() => {
      inFlightRefresh = null;
    });
  }
  return inFlightRefresh;
}

async function doRefresh(refreshToken: string): Promise<AccessTokenResult> {
  const result = await apiPost(
    '/api/v1/auth/mobile/refresh',
    { refresh_token: refreshToken },
    mobileAuthRefreshResponseSchema,
  );
  if (!result.ok) {
    await clearTokens();
    return { ok: false, reason: 'refresh_failed' };
  }
  await storeTokens(result.data);
  return { ok: true, token: result.data.access_token };
}
```

Single-flight invariant: when a refresh is in flight, all subsequent
`getAccessToken()` callers receive the same promise. The
`.finally()` clears the slot whether the refresh succeeded or failed,
so the next call after completion starts fresh. Tests in §9 cover
concurrent invocation explicitly.

On refresh failure, tokens are cleared inside `doRefresh` —
`getAccessToken`'s caller can treat `refresh_failed` as "you've been
signed out, navigate to sign-in" without doing the cleanup itself.

**`apps/mobile/src/auth/sign-in-flow.ts`** — reshape (slice 6 code
change):

```ts
// SLICE 6 RETURN:
//   | { status: 'success'; email: string }
// SLICE 7 RETURN:
export type SignInResult =
  | { status: 'success'; tokens: MobileAuthExchangeResponse }
  | { status: 'cancelled' }
  | { status: 'error'; reason: 'access_denied' | 'generic'; code: string };

// Drops from the deps + flow:
//   - apiGet (no more /me call inside the flow)
//   - storeTokens (AuthProvider.signIn handles it)
//
// Flow becomes: PKCE → /start → openAuthSession → /exchange → return tokens.
// On any failure between /start and /exchange, behaviour is unchanged from slice 6.
```

The "no partial state" invariant moves from sign-in-flow to
AuthProvider: if `signIn(tokens)` calls `/me` and fails, it calls
`clearTokens()` before transitioning to `signed_out`.

**`apps/mobile/src/auth/auth-context.tsx`** — new file:

```ts
const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState<AuthState>({ status: 'unknown' });

  // Cold-start effect — runs once on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const access = await getAccessToken();
      if (cancelled) return;

      if (!access.ok) {
        // 'no_tokens' or 'refresh_failed' — both signed_out.
        // If 'no_tokens', nothing to clear; if 'refresh_failed',
        // doRefresh already cleared.
        setState({ status: 'signed_out' });
        return;
      }

      const me = await apiGet('/api/v1/me', meResponseSchema, access.token);
      if (cancelled) return;

      if (!me.ok) {
        // Q8: ALL /me failures collapse to signed_out.
        await clearTokens();
        setState({ status: 'signed_out' });
        return;
      }

      setState({ status: 'signed_in', me: me.data });
    })();
    return () => { cancelled = true; };
  }, []);

  const signIn = useCallback(async (tokens: MobileAuthExchangeResponse) => {
    await storeTokens(tokens);
    const me = await apiGet('/api/v1/me', meResponseSchema, tokens.access_token);
    if (!me.ok) {
      await clearTokens();
      setState({ status: 'signed_out' });
      return;
    }
    setState({ status: 'signed_in', me: me.data });
  }, []);

  const signOut = useCallback(async () => {
    // Read tokens FIRST, before clearTokens() wipes them — the revoke
    // call needs the refresh token, and the call happens after the
    // optimistic state transition + clear.
    const tokens = await readTokens();
    // Optimistic: transition state + clear Keychain immediately so
    // the UI flips fast. Fire-and-forget revoke runs in the background.
    setState({ status: 'signed_out' });
    await clearTokens();
    if (tokens) {
      // No response schema — endpoint returns 204 No Content.
      void apiPost('/api/v1/auth/mobile/revoke', {
        refresh_token: tokens.refresh_token,
      }).catch(() => { /* fire-and-forget — never throws to caller */ });
    }
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
```

**`apiClient.ts` is extended to handle `204 No Content`.** The
current `request()` helper calls `response.json()` unconditionally,
which throws on an empty 204 body. Extension: short-circuit before
the JSON parse:

```ts
// inside request<T>(...) before response.json():
if (response.status === 204) {
  return { ok: true, data: undefined as T };
}
```

And the public signatures become:

```ts
export type ApiSuccess<T> = { ok: true; data: T };
export type ApiResult<T> = ApiSuccess<T> | ApiFailure;

// responseSchema is optional — omit it for endpoints that return 204.
export async function apiPost<T = void>(
  path: string,
  body: unknown,
  responseSchema?: ZodType<T>,
  bearer?: string,
): Promise<ApiResult<T>>;
```

When `responseSchema` is omitted and the server returns a 2xx with a
body, the body is read-but-not-validated (still `data: undefined`).
Callers that want validation pass a schema; callers that expect 204
omit it.

This is a generic apiClient change — every future endpoint that
returns 204 (e.g. EPIC-002's delete-trip) benefits. The
`signOut()` revoke call below uses the no-schema form:

```ts
void apiPost('/api/v1/auth/mobile/revoke', { refresh_token: tokens.refresh_token })
  .catch(() => { /* fire-and-forget */ });
```

**`apps/mobile/app/_layout.tsx`** — root layout:

```ts
import * as SplashScreen from 'expo-splash-screen';
import { Stack, useSegments, useRouter } from 'expo-router';
import { AuthProvider, useAuth } from '../src/auth/auth-context';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  return (
    <AuthProvider>
      <AuthGuard>
        <Stack screenOptions={{ headerShown: false }} />
      </AuthGuard>
    </AuthProvider>
  );
}

function AuthGuard({ children }: PropsWithChildren) {
  const auth = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (auth.status === 'unknown') return;        // still booting; hold splash
    SplashScreen.hideAsync();

    const inAuthGroup = segments[0] === '(auth)';
    if (auth.status === 'signed_in' && inAuthGroup) {
      router.replace('/');                         // (app)/index
    } else if (auth.status === 'signed_out' && !inAuthGroup) {
      router.replace('/sign-in');                  // (auth)/sign-in
    }
  }, [auth.status, segments, router]);

  return <>{children}</>;
}
```

**No `apps/mobile/app/index.tsx`.** Under Expo Router, route
groups (`(auth)` / `(app)`) add no URL segment, so the initial
URL `/` resolves to `app/(app)/index.tsx`. The MeScreen component
returns `null` while `auth.status === 'unknown'`, so during
cold-start the native splash (held by `preventAutoHideAsync()` in
the root layout) is what the user sees. When AuthProvider
transitions state, the AuthGuard's effect either keeps the user
on `/` (signed-in) or navigates to `/sign-in` (signed-out), and
calls `SplashScreen.hideAsync()` once the destination's first
render is enqueued.

**`apps/mobile/app/(auth)/_layout.tsx`**:

```ts
import { Stack } from 'expo-router';
export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
```

**`apps/mobile/app/(auth)/sign-in.tsx`** — moved verbatim from
`app/index.tsx` (the current slice-6 sign-in screen), with one
change: the post-success handler.

```ts
// SLICE 6:
//   router.replace({ pathname: '/signed-in', params: { email: result.email } });
// SLICE 7:
async function handleSuccess(result: { status: 'success'; tokens: MobileAuthExchangeResponse }) {
  await auth.signIn(result.tokens);
  // Guard effect navigates to /(app)/ automatically when state flips to signed_in.
}
```

The route table `/sign-in` is the only path that lives in the
`(auth)` group for now.

**`apps/mobile/app/(app)/_layout.tsx`**:

```ts
import { Stack } from 'expo-router';
export default function AppLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
```

**`apps/mobile/app/(app)/index.tsx`** — the me screen:

```ts
import { useAuth } from '../../src/auth/auth-context';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, Pressable, View } from 'react-native';

export default function MeScreen() {
  const auth = useAuth();
  // Two reasons to return null:
  //   - status === 'unknown': cold-start in progress; native splash covers UI.
  //   - status === 'signed_out': AuthGuard is about to navigate away.
  // Either way, no me-screen content renders.
  if (auth.status !== 'signed_in') return null;

  const greeting = auth.me.name ? `Hello, ${auth.me.name}` : 'Hello!';

  return (
    <SafeAreaView style={styles.root} testID="me-screen-root">
      <Text style={styles.greeting} testID="me-screen-greeting">{greeting}</Text>
      <Text style={styles.email} testID="me-screen-email">{auth.me.email}</Text>
      {!auth.me.isApproved && (
        <Text style={styles.banner} testID="me-screen-approval-banner">
          Your account is pending approval.
        </Text>
      )}
      <Pressable
        testID="me-screen-sign-out"
        onPress={() => { void auth.signOut(); }}
        style={({ pressed }) => [styles.signOut, pressed && styles.signOutPressed]}
      >
        <Text style={styles.signOutText}>Sign out</Text>
      </Pressable>
    </SafeAreaView>
  );
}
```

Styles use the existing slice-6 neutral palette + system fonts.
44×44pt minimum touch target on the sign-out button per CONSTITUTION
§8.

#### Storage & migrations

No DB migrations. Mobile-side storage continues to use the three
Keychain keys from slice 6 (`access_token`, `refresh_token`,
`access_expires_at`) — slice 7 only adds the read path, not new
keys.

#### External integrations

- **No new Google / OAuth surface.** Sign-in continues to use
  slice 6's server-mediated PKCE flow.
- **`expo-splash-screen`** — already a transitive dep via Expo;
  used here via the public API (`preventAutoHideAsync` /
  `hideAsync`). Native module; no extra config in `app.json` beyond
  what Expo ships by default.

### 7.4 UI / UX

- **Splash**: default Expo splash, held by `preventAutoHideAsync()`
  during cold-start. Auto-shown by Expo at native launch; programmatically
  hidden by the guard effect when `state.status !== 'unknown'`.
- **Sign-in screen** (`/sign-in`): unchanged from slice 6 except for
  the post-success navigation (now delegates to AuthContext + guard
  effect).
- **Me screen** (`/`): centred vertically.
  - Greeting (`<Text>` `28pt`, weight `600`).
  - Email (`<Text>` `16pt`, weight `400`, secondary colour).
  - Approval banner (`<Text>` `14pt`, weight `500`, warning colour)
    — only rendered when `!isApproved`.
  - Sign-out button (`<Pressable>`, 44×44pt min, neutral border,
    label "Sign out", standard `<Text>` `16pt` `500`).
  - Spacing: ~24pt between greeting/email; ~32pt before the
    approval banner / sign-out.
- **Accessibility**: all `<Text>` elements are screen-reader visible
  by default. The sign-out `<Pressable>` carries the label "Sign
  out" via its child `<Text>` — sufficient for VoiceOver to
  announce. Approval banner reads as static text.
- **Responsive**: single-column, mobile-only. ADR 007's three-viewport
  rule does not apply to RN.
- **Colours / fonts**: Expo default palette and system fonts (Q9 —
  branding deferred).

## 8. Security & data considerations

**Threats considered:**

- **Stolen-phone refresh-token replay.** Prior to slice 7, signing out
  on one device left the refresh token valid for 30d. Slice 7's
  `/revoke` endpoint closes this — the presented (active head) row
  is marked revoked server-side, so a thief who already exfiltrated
  it cannot use it post-sign-out. A thief who captured a chain
  *predecessor* instead would trip reuse-detection on their first
  `/refresh` attempt (the row carries `replaced_by_id`), which
  revokes the rest of the chain. Either path converges on "thief
  gets nothing."
- **Revoke-endpoint enumeration.** A naive `/revoke` implementation
  could return `200` for valid tokens and `404` for unknown tokens,
  leaking which tokens exist. Mitigation: `/revoke` returns `204`
  uniformly regardless of whether the token was found. (Same
  rate-limit policy as `/start`/`/exchange`/`/refresh`, so brute-force
  enumeration is throttled at the IP layer.)
- **Reuse-detection race during refresh.** If multiple concurrent
  authenticated calls all hit a 401 and reactively call `/refresh`,
  the second `/refresh` with the same (now-consumed) refresh token
  triggers reuse detection → chain revoked → user surprise-signed-out.
  Mitigation: proactive refresh + single-flight mutex
  (`get-access-token.ts`). Slice 7 only fires `/me`-then-done so this
  doesn't visibly bite, but slice 8+ inherits the safe pattern.
- **Token logging.** Same standard as slice 6 — `Authorization`
  header value is never logged; `/refresh` and `/revoke` request
  bodies are never logged at the route layer (`console.error` only
  logs the error string, not the body).
- **PII in /me responses.** `/me` carries `email` and `name`. The
  me screen renders both. The native app sandbox + Keychain
  protect at-rest; HTTPS in production protects in-transit. Dev
  uses `http://<lan-ip>:3000` per slice 6's accepted dev-only
  exposure.
- **Sign-out optimism.** `signOut()` transitions state +
  clears Keychain *before* the `/revoke` network call resolves. A
  thief who races sign-out and steals the refresh token via a
  side-channel during that ~100ms window could in principle still
  use it. Acceptable for the audience: the thief needs both a
  side-channel into the in-process refresh token AND faster
  network than the legitimate user's `/revoke` call. Real
  mitigation is encrypted-at-rest Keychain (already true).
- **Approval-banner information disclosure.** Showing "Your account
  is pending approval." reveals that the user passed authentication
  but failed authorisation. This is already the closed-auth design
  (ADR 029) — same information is in the web app's behaviour. No
  new disclosure.

**Mitigations beyond the above:**

- The `getAccessToken` mutex is module-scoped, not request-scoped —
  React Strict Mode's double-mount cannot create two parallel
  refresh attempts because both invocations share the same
  promise slot. Test explicitly.
- `AuthProvider.signOut` clears Keychain before transitioning
  state to `signed_out`, ensuring no UI state observes "we're
  signed-out but Keychain still has tokens."
- All `apiPost` / `apiGet` failures inside AuthProvider that yield
  `signed_out` first call `clearTokens()` to keep Keychain and
  state in lock-step.

**Secrets needed:** none new. Reuses the existing JWT signing key,
Google OAuth client, Resend API key, etc.

## 9. Test plan

Tests written **before** implementation per CONSTITUTION.md §3.

### E2E (Maestro, mobile side)

| Test file | What it covers |
|---|---|
| `apps/mobile/.maestro/flows/launch.yaml` | **Unchanged behaviour, but re-verified after route restructure.** CI sim has no Keychain entries, so the redirector lands on `/sign-in` → asserts `login-screen-root` testID is on screen. |
| `apps/mobile/.maestro/flows/sign-in.yaml` | **Unchanged behaviour.** Asserts the sign-in screen renders + tap-button transitions to in-flight. Stops short of OAuth (same reason as slice 6 — Google blocks automation). |
| (No new YAML.) | The me screen + sign-out journey can't be Maestro-driven without bypassing Google OAuth. See §5 — deferred to EPIC-002 / TestFlight era. |

### Integration (Vitest + Testcontainers, web side)

| Test file | What it covers |
|---|---|
| `apps/web/src/app/api/v1/auth/mobile/revoke/route.int-test.ts` | **NEW.** (a) Valid refresh token → 204 + the presented row marked `revoked_at` (predecessors untouched); (b) already-revoked token → 204 + idempotent (no `revoked_at` bump on the already-revoked row); (c) unknown / never-existed token → 204 (don't leak existence); (d) malformed body (missing field, wrong type) → 400 `validation_failed`; (e) above rate-limit threshold → 429 `rate_limited`; (f) `/refresh` with the just-revoked token → 401 `refresh_revoked` (round-trip with the existing refresh endpoint); (g) `/refresh` with an *un-revoked* predecessor that was rotated normally before sign-out → 401 `refresh_reused` (reuse-detection takes over for predecessors). |
| All SPEC-001/002/004/005/006 web-side `.int-test.ts` | **Stay green unchanged.** Slice 7 doesn't touch the web side except for the new `/revoke` endpoint. |

### Unit (Vitest, web side)

| Test file | What it covers |
|---|---|
| `apps/web/src/application/use-cases/auth/mobile/revoke-mobile-tokens.test.ts` | **NEW.** (a) Known token → calls `revokeChain([found.id], now)` once with the presented row's id only; (b) unknown token → no `revokeChain` call (no DB writes); (c) already-revoked token → still calls `revokeChain([found.id], now)` (idempotent at the repo level — `revokeChain` already only updates non-revoked rows per the slice-3 implementation). |

### Unit (Jest + RNTL, mobile side)

| Test file | What it covers |
|---|---|
| `apps/mobile/__tests__/auth/keychain.test.ts` | **EXTENDED.** Existing `storeTokens` / `clearTokens` cases unchanged. NEW: (a) `readTokens()` returns full bundle when all three keys are set; (b) `readTokens()` returns `null` when any one key is missing (partial-state defensive); (c) `readTokens()` returns `null` after `clearTokens()`. |
| `apps/mobile/__tests__/auth/get-access-token.test.ts` | **NEW.** (a) No tokens → `{ ok: false, reason: 'no_tokens' }`; (b) Valid token (now < expires - 60s) → `{ ok: true, token }` and no `/refresh` fired; (c) Expired token + successful `/refresh` → `{ ok: true, token: newToken }` and new tokens persisted; (d) Expired token + failed `/refresh` → `{ ok: false, reason: 'refresh_failed' }` and Keychain cleared; (e) **Single-flight invariant**: two concurrent `getAccessToken()` calls when expired both resolve to the same token, with exactly one `apiPost('/refresh')` call observed via `jest.spyOn(fetch)`. |
| `apps/mobile/__tests__/auth/sign-in-flow.test.ts` | **REDUCED from slice 6.** Drop: (a) the /me-success-extracts-email branch; (b) the /me-failure-no-persist branch. Keep: happy path (now asserts `{ status: 'success'; tokens }` return); cancellation; access_denied; generic /exchange error. The `storeTokens` and `apiGet` mocks are removed from the deps map. |
| `apps/mobile/__tests__/auth/auth-context.test.tsx` | **NEW.** Renders `AuthProvider` with `useAuth` consumer; mocks `readTokens` + `getAccessToken` + `apiGet` + `apiPost` + `storeTokens` + `clearTokens`. Cases: **(cold-start)** (a) no tokens → state goes `unknown` → `signed_out`; (b) valid token + /me success → `unknown` → `signed_in` with the MeResponse; (c) expired token + /refresh success + /me success → `unknown` → `signed_in`; (d) expired token + /refresh failure → `unknown` → `signed_out` (Keychain already cleared by `getAccessToken`); (e) valid token + /me 401 → `unknown` → `signed_out` + Keychain cleared; (f) valid token + /me network failure (envelope `code: 'internal'`) → `unknown` → `signed_out` + Keychain cleared (Q8 — all failures collapse). **(signIn)** (g) success → state goes to `signed_in` with the MeResponse, `storeTokens` called once; (h) /me failure post-exchange → state goes to `signed_out`, Keychain cleared. **(signOut)** (i) tokens present → state goes immediately to `signed_out`, Keychain cleared, `/revoke` fired with the refresh token; (j) `/revoke` rejection → still resolves successfully (fire-and-forget never throws); (k) tokens already absent → state goes to `signed_out`, no `/revoke` call. |
| `apps/mobile/__tests__/app/(auth)/sign-in.test.tsx` | **MOVED + ADJUSTED.** Adapt the slice-6 `app/index.test.tsx` test suite. The four UI branches (idle / in-flight / access_denied / generic) stay; the post-success assertion changes from "`router.replace({ pathname: '/signed-in', params: { email } })`" to "`auth.signIn(tokens)` called once with the exchange tokens" (mocked via a test AuthProvider). |
| `apps/mobile/__tests__/app/(app)/index.test.tsx` | **NEW.** Render the me screen wrapped in a test AuthProvider that injects a fixture auth state. Cases: (a) `status === 'unknown'` → renders `null` (no testIDs in tree); (b) `signed_in`, `name === 'Matt'` → "Hello, Matt" + email visible; (c) `signed_in`, `name === null` → "Hello!" + email visible; (d) `signed_in`, `isApproved === false` → approval banner visible (and Hello + email still render); (e) `signed_in`, sign-out tap → `auth.signOut()` called once. |
| `apps/mobile/__tests__/app/index.test.tsx` | **DELETED** — the slice-6 sign-in test moves to `(auth)/sign-in.test.tsx` and the file `app/index.tsx` itself is renamed (`git mv`) into `(auth)/sign-in.tsx`, so no test at this path. |
| `apps/mobile/__tests__/app/signed-in.test.tsx` | **DELETED** — the file `app/signed-in.tsx` is removed in this slice. |

Approximate test deltas: web side +~20 tests (revoke endpoint + use
case); mobile side: existing 46 (slice 6) → ~70 (slice 7), in ~10
test files.

### Manual checks

1. **Cold-start, no tokens.** Fresh install (delete app + reinstall
   via Expo Go scan). Launch → splash → sign-in screen renders.
2. **Cold-start, valid tokens.** Sign in via slice 6's flow (must be
   pre-approved Google account). Force-quit the app. Reopen via Expo
   Go. Splash holds briefly, then me screen renders showing "Hello,
   Matt" + author's email + Sign out button.
3. **Cold-start, expired access token, valid refresh.** Sign in.
   Advance the device clock by 20 minutes (Settings → General → Date
   & Time, disable Set Automatically, set forward 20m). Force-quit
   + reopen. Splash holds slightly longer (one refresh round-trip),
   then me screen renders normally. Reset the clock afterward.
4. **Sign-out + relaunch.** On the me screen, tap Sign out. Within
   ~100ms the sign-in screen appears. Inspect the server's
   `refresh_tokens` table — every row in the most recent chain has
   `revoked_at` populated. Force-quit + reopen the app — sign-in
   screen renders again.
5. **Sign-out with server down.** Stop `pnpm dev` server. On the
   me screen, tap Sign out. The sign-in screen still appears within
   ~100ms (fire-and-forget; the `/revoke` call fails silently in the
   background). Keychain is cleared. Restart `pnpm dev` and re-sign-in
   works.

## 10. Observability

- **Logs (mobile)**. Same standard as slice 6:
  - `console.warn` on every non-success branch of cold-start, signIn,
    signOut. Format: `[auth] <event> reason=<code>`.
    Events: `cold_start_failed`, `sign_in_failed`, `revoke_failed`.
    Never logs tokens, never logs email.
  - `console.error` only for unexpected throws (e.g. an
    `expo-secure-store` exception, which would indicate a platform
    bug).
- **Logs (web)**. The new `/revoke` route uses `console.error`
  on unexpected exceptions, matching the pattern in `/refresh`.
  Normal 204 paths don't log — too chatty.
- **Metrics**: none new in this slice.
- **Sentry / error reporting**: still slice 9. The `console.warn`
  format is Sentry-shape-compatible; slice 9 will wrap them
  without restructuring call sites. The web-side `/revoke` does NOT
  fire `Sentry.captureMessage` on normal revokes — `/refresh`'s
  chain-revoke event is the interesting one (it indicates
  reuse-detection fired), normal sign-out revokes are uninteresting.

## 11. Rollback / safety

- **Server side.** Reverting `/revoke` is a clean `git revert` of
  the slice's web commits — no DB migration to roll back. Existing
  `refresh_tokens` rows that this slice marked `revoked_at` would
  stay revoked (no need to undo). Forward-compatible: the next
  `/refresh` for a revoked chain already correctly returns
  `refresh_revoked`.
- **Mobile side.** Reverting the slice means scanning the prior
  Expo Go bundle (slice-6 sign-in screen + `/signed-in` placeholder).
  Any Keychain entries from slice-7 sign-ins remain valid and would
  resume working on slice 6's bundle (slice 6 doesn't read Keychain
  but doesn't actively clear it either). Users who had signed out
  via slice 7 still have a revoked chain server-side — they'd need
  to re-sign-in via slice 6, which mints a fresh chain.
- **No DB migrations to revert.**
- **CI roll-back.** The `mobile-e2e` job (still `continue-on-error:
  true` per SPEC-006 §11 unless promoted in the interim) is unaffected
  by the route-group restructure as long as `launch.yaml`'s assertion
  on `login-screen-root` continues to pass. If it doesn't,
  `continue-on-error` keeps the job non-blocking until fixed.
- **No money, no destructive data ops.**

## 12. Implementation order

Tests-first per CONSTITUTION.md §3. Each step pairs intent with
verification and is small enough to commit on its own.

1. [ ] **Intent:** Add `mobileAuthRevokeRequestSchema` to
   `packages/shared/src/mobile-auth.ts` + re-export from
   `packages/shared/src/index.ts`. **Verification:**
   `pnpm --filter @travel-planner/shared type-check` exits 0;
   `pnpm --filter @travel-planner/web type-check` still passes (no
   consumer yet); `pnpm --filter @travel-planner/mobile type-check`
   still passes. (Day 1 morning.)

2. [ ] **Intent:** Write the revoke-mobile-tokens use case unit
   test
   (`apps/web/src/application/use-cases/auth/mobile/revoke-mobile-tokens.test.ts`)
   covering the three cases in §9. Cases are red. (The
   `rateLimitOrReject` `endpoint` parameter is `string` — no type
   change needed for `'revoke'`.) **Verification:** `pnpm test:unit`
   shows the new test file failing as expected. (Day 1 morning.)

3. [ ] **Intent:** Implement
   `apps/web/src/application/use-cases/auth/mobile/revoke-mobile-tokens.ts`
   per §7.1 (single-row revoke via `revokeChain([found.id], now)`,
   no new repository methods). **Verification:** Step 2's unit
   tests pass. `pnpm test:unit` exits 0. (Day 1 morning.)

4. [ ] **Intent:** Write the integration test
   `apps/web/src/app/api/v1/auth/mobile/revoke/route.int-test.ts`
   covering the six cases in §9 (valid → 204 + chain revoked;
   already-revoked → 204 idempotent; unknown → 204; malformed body
   → 400; rate-limit → 429; /refresh after /revoke → 401
   refresh_revoked). Cases are red.
   **Verification:** `pnpm test:integration` shows the new file
   failing. (Day 1 afternoon.)

5. [ ] **Intent:** Implement the
   `apps/web/src/app/api/v1/auth/mobile/revoke/route.ts` handler
   matching the design in §7.1. **Verification:** Step 4's
   integration tests pass; existing /refresh + /exchange + /start +
   /callback tests stay green. `pnpm test:integration` exits 0.
   (Day 1 afternoon.)

6. [ ] **Intent:** Extend `apiClient.ts` to handle 204 No Content
   responses (`if (response.status === 204) return { ok: true,
   data: undefined as T };` before the `response.json()` call).
   Update the type so `apiPost<T = undefined>` is valid. Add a
   unit test in `apps/mobile/__tests__/api/client.test.ts` for the
   204 case. **Verification:**
   `pnpm --filter @travel-planner/mobile test` exits 0 with the new
   case green. (Day 2 morning.)

7. [ ] **Intent:** Add `readTokens()` to
   `apps/mobile/src/auth/keychain.ts` + extend
   `__tests__/auth/keychain.test.ts` with the three cases in §9.
   **Verification:** `pnpm --filter @travel-planner/mobile test`
   exits 0. (Day 2 morning.)

8. [ ] **Intent:** Write `__tests__/auth/get-access-token.test.ts`
   covering the five cases in §9 (including the single-flight
   concurrency case). Cases are red.
   **Verification:** Jest shows the new file failing. (Day 2 morning.)

9. [ ] **Intent:** Implement
   `apps/mobile/src/auth/get-access-token.ts` matching the design
   in §7.3. **Verification:** Step 8's tests pass.
   `pnpm --filter @travel-planner/mobile test` exits 0. (Day 2 morning.)

10. [ ] **Intent:** Reshape `apps/mobile/src/auth/sign-in-flow.ts`
    per §7.3 — drop `apiGet` + `storeTokens` from deps; change
    return type to `{ status: 'success'; tokens }`; remove the /me
    proof step. Reduce `__tests__/auth/sign-in-flow.test.ts`
    accordingly (drop the /me-as-proof and /me-failure branches,
    update the happy-path assertion). **Verification:** Jest passes
    with the reduced suite; type-check passes. (Day 2 afternoon.)

11. [ ] **Intent:** Write `__tests__/auth/auth-context.test.tsx`
    covering the eleven cases in §9 (cold-start a–f, signIn g–h,
    signOut i–k). Cases are red.
    **Verification:** Jest shows the new file failing. (Day 2
    afternoon / Day 3 morning — this is the densest test step.)

12. [ ] **Intent:** Implement
    `apps/mobile/src/auth/auth-context.tsx` matching §7.3.
    **Verification:** Step 11's tests pass.
    `pnpm --filter @travel-planner/mobile test` exits 0. (Day 3.)

13. [ ] **Intent:** Restructure routes. (a) `git mv
    apps/mobile/app/index.tsx apps/mobile/app/(auth)/sign-in.tsx` —
    preserves blame history; the old route `/` for sign-in is gone.
    (b) `git rm apps/mobile/app/signed-in.tsx` and its test file
    `apps/mobile/__tests__/app/signed-in.test.tsx`. (c) `git rm
    apps/mobile/__tests__/app/index.test.tsx` (the slice-6 sign-in
    test; its replacement lives at
    `apps/mobile/__tests__/app/(auth)/sign-in.test.tsx`). (d)
    Create `apps/mobile/app/(auth)/_layout.tsx` and
    `apps/mobile/app/(app)/_layout.tsx` stubs (both are
    `<Stack screenOptions={{ headerShown: false }} />`). (e) Create
    `apps/mobile/app/(app)/index.tsx` skeleton — a default export
    returning `null` for now. (f) Rewrite `apps/mobile/app/_layout.tsx`
    per §7.3: `SplashScreen.preventAutoHideAsync()` at module top,
    `<AuthProvider><AuthGuard><Stack/></AuthGuard></AuthProvider>`.
    Do **not** create a bare `apps/mobile/app/index.tsx` — it would
    collide with `(app)/index.tsx` at URL `/`.
    **Verification:** `pnpm --filter @travel-planner/mobile
    type-check` exits 0; `pnpm dev:mobile` starts and renders
    either sign-in or me screen depending on Keychain state (manual
    check via Simulator); no Expo Router "duplicate route" warnings
    in the Metro console. (Day 3 / Day 4.)

14. [ ] **Intent:** Adjust the moved
    `__tests__/app/(auth)/sign-in.test.tsx` — change the
    post-success assertion from `router.replace({...})` to
    `auth.signIn(tokens)` (via a test AuthProvider wrapper);
    re-verify all four UI branches still pass.
    **Verification:** Jest exits 0. (Day 4.)

15. [ ] **Intent:** Write `__tests__/app/(app)/index.test.tsx`
    (the me screen) covering the five cases in §9 (unknown→null;
    name present; name null; !isApproved; sign-out tap). Cases are
    red. **Verification:** Jest shows the new file failing. (Day 4.)

16. [ ] **Intent:** Implement `app/(app)/index.tsx` matching §7.3.
    **Verification:** Step 15's tests pass.
    `pnpm --filter @travel-planner/mobile test` exits 0. (Day 4.)

17. [ ] **Intent:** Verify `launch.yaml` Maestro flow still passes
    against the restructured routes. If the testID-on-launch has
    changed (e.g. because the redirector flicker exposes a
    different root briefly), update the flow assertion.
    **Verification:** `pnpm test:e2e:mobile` exits 0
    locally. (Day 5 morning.)

18. [ ] **Intent:** Update `apps/mobile/AGENTS.md` — add new
    `src/auth/` module references (`auth-context.tsx`,
    `get-access-token.ts`, `keychain.ts` `readTokens` note);
    update the "Sign-in flow + API client" subsection to reflect
    the reshape; note the `apiClient` 204-handling extension;
    update the testID convention to include the new me-screen
    testIDs; add `(auth)` / `(app)` to the file-system-routing
    subsection; update the post-sign-in redirect description.
    **Verification:** Reads cleanly; `pnpm lint` exits 0. (Day 5 morning.)

19. [ ] **Intent:** Update `EPIC-001` §7 slice 7 row to
    `Done` + append the close-out row to the slice ledger. Update
    `docs/specs/README.md` index. **Verification:** docs-only;
    `pnpm lint` exits 0. (Day 5 morning.)

20. [ ] **Intent:** Triage
    `docs/implementation-notes/SPEC-007-mobile-authenticated-me-and-signout.md`
    per ADR 048. Move "design intent changed" entries to §Implementation
    Deviations of this SPEC; move learnings to §Post-Implementation
    Notes; move anything that outlives the spec to `docs/tech-debt.md`.
    Fill in the triage summary table. **Verification:** notes
    file's triage table is filled in; `pnpm lint` exits 0. (Day 5.)

21. [ ] **Intent:** Update `EPIC-001` §3 definition-of-done
    checkboxes for "home screen shows the authenticated user's
    name" (now true). If all other checkboxes are also true,
    update the epic's `Status:` header to `Complete` and write the
    `Post-epic notes` section. **Verification:** docs-only;
    `pnpm lint` exits 0. (Day 5.)

22. [ ] **Intent:** Final full verification suite.
    **Verification:** From repo root, `pnpm lint &&
    pnpm db:check:migrations && pnpm type-check && pnpm test:unit
    && pnpm test:integration` all exit 0; `POSTGRES_URL=... pnpm
    build` exits 0; `pnpm test:e2e:mobile` exits 0; all five
    manual on-device dry-runs in §9 pass. (Day 5.)

## 13. ADR triggers and tech-debt review

### ADR?

- [ ] **New library, external tool, or vendor** — N/A.
      `expo-splash-screen` is a stock Expo first-party module
      already transitively available. No new package install
      surface beyond what slice 6 already shipped.
- [ ] **CI pipeline or workflow structural change** — N/A. The
      `mobile-e2e` job from SPEC-006 / ADR 055 is unchanged. No new
      jobs.
- [ ] **New project-wide standard** — N/A. The auth-state-machine
      pattern is mobile-internal and documented in
      `apps/mobile/AGENTS.md` updates (step 19).
- [ ] **Non-obvious architectural trade-off** — borderline. The
      proactive-refresh + single-flight mutex is a deliberate
      design choice but it's a slice-level implementation detail
      that sits cleanly under EPIC §10's "Mobile auth model" row
      (which already settled "rotating refresh tokens with reuse
      detection"). Documenting it in this SPEC §7.3 +
      `apps/mobile/AGENTS.md` is the right scale; no new ADR.
- [ ] **Cross-cutting decision not already settled by the parent
      epic** — N/A. All cross-cutting decisions inherited.

**ADRs to write:** None outstanding.

### Tech debt

- [x] I reviewed `docs/tech-debt.md`:
  - **TD-003** — Expo SDK 54 downgrade. Stays open; slice 7 builds
    on SDK 54. Re-upgrade trigger unchanged.
  - **TD-004** — direct on-device OAuth via `expo-auth-session` +
    iOS-type Google client. Stays open; slice 7 keeps the
    server-mediated PKCE flow inherited from slice 6. Trigger
    unchanged: EPIC-002 / ADP funded.
  - **TD-005** — dev-only dependabot transitives (esbuild,
    @tootallnate/once). Unaffected. New tests use the same vitest
    version already in place; no transitive dep changes.
  - **TD-006** — TypeScript 5.9.3 → 6.0.x hold. Unaffected.
  - **TD-007** — Vite 7 → 8 hold. Unaffected.
  - **TD-008** — `@vercel/postgres` deprecation. Unaffected; the
    /revoke endpoint uses the existing DrizzleRefreshTokenRepository,
    not a new database client.

**Tech debt items addressed by this spec:** None. Slice 7 is small
enough that there's no opportunistic pay-down. TD-003 / TD-004 both
have triggers pegged to EPIC-002 events.

## 14. Risks & open questions

- **`apiClient.ts` 204 handling change is upstream-of-everything.**
  Step 6 extends `apiClient` to handle 204. This is a generic
  client change that any future endpoint may rely on. The test
  added in step 6 covers the happy path, but a subtle bug could
  surface as "the entire api client mishandles 204s". Mitigation:
  the change is ~3 lines, the test covers both 204 (sentinel
  return) and non-204 (existing behaviour). Code review focus point.
- **Expo Router route-group restructure.** Moving files into
  `(auth)/` and `(app)/` directories breaks git-blame continuity if
  not done via `git mv`. Step 13 must use `git mv`. The Maestro
  flows are written against testIDs not paths, so the route paths
  themselves change without breaking flows.
- **`SplashScreen.hideAsync()` timing.** Documented Expo issue is
  that calling hideAsync too early can cause a one-frame flash. The
  design calls it from inside the AuthGuard's effect after state
  transitions out of `unknown` — should be after the next render
  enqueues the destination screen. Manual dry-run 1 + 2 will catch
  any flash regression.
- **React Strict Mode double-mount.** In dev mode, React 18+ Strict
  Mode double-invokes effects. The AuthProvider's cold-start effect
  will fire twice. The first run kicks off the work; the second
  needs to NOT kick off a duplicate. Mitigation: the
  `cancelled` flag in the effect closure handles this — the second
  mount's effect cleanup runs first, setting `cancelled = true` on
  the first run, before the second run's body executes. The
  single-flight mutex in `get-access-token` also de-dupes the actual
  network call. Test step 11 includes a "AuthProvider re-mount
  during boot" case to be explicit.
- **`signIn`'s "write tokens before /me succeeds" ordering.** Q7
  decision: AuthProvider writes tokens, then calls /me, then
  rolls back on failure. The rollback window (~few hundred ms) is
  acceptable, but it means a force-quit at exactly the wrong moment
  could leave Keychain with tokens that the next cold-start would
  attempt to use. That's fine — the next cold-start's /me call
  would either succeed (the tokens were good, the original /me
  just hit a transient blip) or fail and clear them. End state
  converges.
- **Test coverage of the proactive-refresh machinery in production
  use.** Slice 7's only consumer of `getAccessToken` is the
  cold-start path. The full single-flight concurrency story isn't
  exercised in production until slice 8's first concurrent
  authenticated call. Step 8's unit tests cover the mechanism but
  there's no integration-test signal. Accepted — see SPEC §5 "out
  of scope" and §9 manual check 3.
- **`/revoke` 204 + `apiPost` schema-optional ergonomics.** Making
  the schema parameter optional changes the apiPost call shape for
  all existing callers (none today require body-less calls, so no
  regression — but worth a code-review pass on the type widening
  to ensure no existing call site silently loses validation).
- **Approval banner copy & translation.** Slice 7 is English-only
  (matching slice 6); the banner text is hardcoded. No i18n
  infrastructure to plug into yet. Accepted scope decision.
- **EPIC-001 §3 closure.** Step 22 closes the epic if all DoD
  checkboxes flip true. Worth a careful re-read of EPIC §3 at
  close-out — there may be items (mobile testing infra, Sentry RN)
  that are still on the DoD list and would block flipping the
  epic-level Status. Sentry RN is slice 9, which is "Not started"
  — so the epic Status will move to "Slice 7 done, slice 9
  remaining" rather than fully Complete. Re-evaluate at step 22.

---

## Implementation Deviations

> **Instruction to implementing agent:** During implementation, capture
> deviations and observations as they happen in
> `docs/implementation-notes/SPEC-007-mobile-authenticated-me-and-signout.md`
> (rolling log). At close-out, triage that log and populate this table
> with anything that changed the design intent vs. this approved spec.
> Use the spec's Post-Implementation Notes for learnings, and
> `docs/tech-debt.md` for unresolved debt that must outlive the spec.
>
> Be honest — this section is for learning, not blame.

| # | Deviation | Reason | Impact | Resolved? |
|---|-----------|--------|--------|-----------|
| 1 | **Use case test convention: `revoke-mobile-tokens.int-test.ts` (not `.test.ts`).** SPEC §9 specified a unit test file. | `apps/web/src/application/AGENTS.md` says "every use case must have a co-located integration test (`.int-test.ts`)" and all four existing mobile auth use cases follow that. Wrote a real integration test against Testcontainers Postgres + `DrizzleRefreshTokenRepository`. | All §3 AC for `/revoke` still verified, just via integration test rather than unit test. Test count: 55/278 → 55/281 integration after step 3. | Yes. |
| 2 | **Crypto method name: `sha256Base64url` (not pseudocode `hashRefreshToken`).** SPEC §7.1's revoke use case pseudocode named the wrong method. | The actual `MobileAuthCrypto` port exposes `sha256Base64url(input)` — was used by `refreshMobileTokens` for the same purpose. Used the correct method. | Zero impact on design intent ("hash the presented cleartext, look it up, revoke"); SPEC §7.1 text remains slightly inaccurate but the implementation is correct. | Yes. |
| 3 | **Route int-test consolidated into `apps/web/src/app/api/v1/auth/mobile/route.int-test.ts`** (added a new `describe('/api/v1/auth/mobile/revoke')` block), not a new per-route file as SPEC §9 specified. | All four existing mobile auth endpoints share that one file with separate describe blocks. Per-endpoint files would fork the pattern unhelpfully. | Seven new tests added to the consolidated file: 204 happy + 204 idempotent + 204 unknown + 2 × 400 validation_failed + 2 × cross-endpoint round-trip (revoke→refresh refresh_revoked; revoke active head, then predecessor→refresh_reused via reuse-detection). | Yes. |
| 4 | **No explicit 429 rate-limit test for `/revoke` route.** SPEC §3 AC #17 + §9 case (e) called for one. | The existing `/refresh` route int-test has no 429 test for the same reason: rate-limit machinery is shared across all four endpoints via `_lib/with-rate-limit.ts` and has its own int-test at `drizzle-auth-rate-limit-repository.int-test.ts`. `/revoke`'s wiring is byte-identical to `/refresh`'s. Adding a 429 test here would test the shared helper a fifth time. | AC #17 is verified-by-shared-test rather than by a /revoke-specific test. If the wiring drifts, the int-test files for `start/exchange/refresh/revoke` would all break together. | Yes — documented justification, not a debt item. |
| 5 | **`expo-splash-screen` was not actually a transitive Expo dep.** SPEC §6 prerequisites + §7.3 design assumed it was already available. | Installed via `pnpm exec expo install expo-splash-screen` (resolves to `~31.0.13` for SDK 54). Adds one entry to `apps/mobile/package.json`. Used `expo install` rather than `pnpm add` to keep version aligned with Expo's bundled-native-modules manifest. | Adds one runtime dep to mobile. Lockfile diff bounded — `expo install` chose the SDK 54-compatible version. | Yes. |

### Post-Implementation Notes

**Phase C → Phase D sequencing via transitional bridge.** After
step 12 landed `AuthProvider`, the existing `app/index.tsx` and
`app/signed-in.tsx` no longer type-checked (they referenced the
removed `SignInResult.email` field + `apiGet`/`storeTokens` deps).
CONSTITUTION §10 requires every commit to leave the codebase in a
working state. Rather than balloon the Phase C commit, added a
transitional bridge: wrap root layout in `<AuthProvider>` (without
the AuthGuard logic), have the sign-in screen call
`auth.signIn(result.tokens)` then navigate to `/signed-in`, and
have the placeholder read email from `useAuth().me.email`. This
left Phase D as a 100% mechanical `git mv` restructure with no
design decisions inside it — Phase D's commit shows exactly the
file moves + the route-group `_layout.tsx` stubs + the real me
screen, nothing else. Worth repeating for future big-restructure
slices: separate "make the new thing work in place" from "move
the files."

**RNTL `fireEvent.press()` ergonomics.** Initial AuthProvider test
pattern called `screen.getByTestId('x').props.onPress()` directly
to trigger Pressable handlers. That fails — RNTL doesn't surface
`onPress` as a prop on the queried element. The correct API is
`fireEvent.press(element)`. Documented in `apps/mobile/AGENTS.md`'s
"Component testing" section so future test authors don't burn the
same ~5 minutes.

**Predecessor revocation via reuse-detection.** SPEC-007 §1's
design claim was that single-row revoke at the active head is
sufficient because reuse-detection in `/refresh` covers
predecessors. This was load-bearing for the "no `findChainIds`
needed" simplification (review-spec Critical #1). The
cross-endpoint integration test
(`route.int-test.ts:'cross-endpoint: /refresh on an un-revoked
predecessor triggers reuse-detection'`) exercises the claim
end-to-end with real Postgres: rotate normally → revoke active
head → present predecessor to `/refresh` → expect `refresh_reused`.
Green. The design holds.

**Test count deltas across the slice:**

| Phase | Web int | Web unit | Mobile |
|-------|---------|----------|--------|
| Baseline (post SPEC-006) | 54 / 275 | 49 / 410 | 7 / 46 |
| Phase A — server-side /revoke | 55 / 285 (+10) | 49 / 410 (no change) | 7 / 46 |
| Phase B — apiClient 204 + readTokens + getAccessToken | 55 / 285 | 49 / 410 | 8 / 61 (+15) |
| Phase C — sign-in-flow reshape + AuthProvider + bridge | 55 / 285 | 49 / 410 | 9 / 72 (+11 net: +12 from auth-context, −2 from sign-in-flow shrink, +1 net adjustments) |
| Phase D — route restructure + me screen | 55 / 285 | 49 / 410 | 9 / 75 (+3 net: +5 me-screen, −2 from deleted signed-in test) |

Web side stays exactly unchanged in unit count (49 / 410 — slice
adds no web-side unit tests; all new use-case coverage is integration).
Mobile + integration tests are where the SPEC's design lives.

**Final commit count: 8 step commits plus the planning docs commit
and the Phase A deviation notes commit (10 total in this slice).**
Each commit a working state; lint + type-check + tests green between.

**EPIC-001 §3 DoD status after this slice:**

| Checkbox | Status |
|---|---|
| Author's iPhone has app installed via Expo Go | Will be re-verified by manual dry-run §9 |
| Author signs in with Google via PKCE → JWT in iOS Keychain | ✅ Shipped in SPEC-006 |
| Home screen shows the authenticated user's name | ✅ Shipped in this slice |
| Mobile testing infrastructure (Jest + RNTL + Maestro CI) | ✅ Shipped in SPEC-003 |
| Sentry RN + EAS source maps | ❌ Slice 9 (not started) |
| Web app behaves identically | ✅ All web tests stay green |
| All pre-existing tests stay green | ✅ Web 49/410 unit + 54→55/275→285 int |

Slice 9 (Sentry RN) is the only remaining EPIC-001 work after
SPEC-007 closes; the user-visible milestone is met.
