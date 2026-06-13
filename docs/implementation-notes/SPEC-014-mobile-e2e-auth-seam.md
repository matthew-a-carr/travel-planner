# Implementation Notes — SPEC-014: Mobile E2E — Test-Auth Seam + Signed-In Journey

**Spec:** [SPEC-014-mobile-e2e-auth-seam](../specs/SPEC-014-mobile-e2e-auth-seam.md)
**Started:** 2026-06-13

> Rolling log written by the implementing agent. Append new entries at the
> bottom as they happen — do not rewrite history. Each entry is a single
> observation, decision, or surprise. At spec close-out, every entry is
> triaged into one of: spec deviations table, spec post-implementation notes,
> docs/tech-debt.md, or discarded.

## Entries

### 2026-06-13 — use case mirrors `handle-mobile-callback` minus Google

**Step:** Step 2 — `mint-test-exchange-code` use case
**Type:** decision
**Note:**

Rather than invent a new flow, `makeMintTestExchangeCode` is structurally
`handle-mobile-callback` with the Google `exchangeAuthCode` step removed:
same state validation (single-use + TTL), same access check
(`findByEmail` → `isApproved`), same one-time-code minting keyed to the
state's stored `code_challenge`, same `travelplanner://auth?...` deep-link
contract. That's what lets the substitute browser leg return the *identical*
URL shape `/callback` 302-redirects to, so `runSignInFlow` can't tell the
seam from the real flow — and the real `/exchange` verifies the client's
verifier against the minted challenge with zero special-casing.

**Triage (filled at close-out):** spec post-impl note — the parallel is the
design's load-bearing property.

### 2026-06-13 — gate is evaluated per request, not at module load

**Step:** Step 3 — `/test-token` route double gate
**Type:** decision
**Note:**

`seamEnabled()` reads `process.env.E2E_TEST_AUTH` / `process.env.VERCEL`
inside the handler so the route int-test can toggle both between cases in one
vitest process (404-when-unset, 404-on-Vercel-even-when-set, 200-when-both).
A test-only endpoint reading two env vars per call is free. The kill-criterion
proof (AC3) is the first of those cases.

**Triage:** discarded — captured in the SPEC §14 already.

### 2026-06-13 — `EXPO_PUBLIC_*` inlining vs unit-testability

**Step:** Step 4 — `resolveBrowserLeg`
**Type:** surprise/decision
**Note:**

Expo inlines `process.env.EXPO_PUBLIC_*` at bundle time, which makes a
module-top read awkward to unit-test (the value is frozen by babel). Gave
`resolveBrowserLeg(flag = process.env.EXPO_PUBLIC_E2E_AUTH)` an injectable
parameter: the screen calls `resolveBrowserLeg()` (reads the inlined env), the
unit test passes the flag explicitly. The substitute itself (`e2eOpenAuthSession`)
is tested directly with a fetch spy, so the meaty logic isn't behind the env
guard at all.

**Triage:** spec post-impl note.

### 2026-06-13 — full local verification green

**Step:** Verification
**Type:** observation
**Note:**

`pnpm lint` ✓, `pnpm type-check` (web + mobile) ✓, `pnpm test:unit`
(web 439 + mobile 124) ✓, `pnpm test:integration` (61 files / 330 tests,
incl. the new `mint-test-exchange-code.int-test.ts` and the extended
`route.int-test.ts`) ✓, `pnpm build` ✓ (the `/api/v1/auth/mobile/test-token`
route shows in the route manifest), `pnpm openapi:check` ✓ (the seam is
deliberately unpublished, so no spec drift). The `mobile-e2e` macOS job is the
remaining gate — it runs the `signed-in-journey` flow against the real backend
on the impl PR.

**Triage:** spec post-impl note (runtime delta for slice 4's budget checkpoint
recorded once the PR's `mobile-e2e` run lands).

### 2026-06-13 — first `mobile-e2e` run red: ATS blocked the app's first request

**Step:** CI (run 27460494075)
**Type:** surprise (real bug, fixed)
**Note:**

`sign-in.yaml` passed; `signed-in-journey` failed all 3 attempts on
`trips-screen-root is visible` after tapping Sign in (~86s each — waited the
full 60s). `trips-screen-root` is the always-rendered trips wrapper, so the app
never reached the trips screen → the **auth round-trip never completed**.

Root cause: this was the **first CI run where the Release app makes a real
`/api/v1/*` request** (EPIC-002's read screens were component-tested only;
SPEC-013's smoke makes no API call). `app.json` had **no ATS config**, so the
Release build's default App Transport Security **blocked cleartext HTTP to
`http://127.0.0.1:3000`** — the very first call (`/start`, before the browser
leg even runs) failed. The signed-out smoke passed precisely because it makes
zero network calls.

Fixes pushed:
1. **`app.json` → `ios.infoPlist.NSAppTransportSecurity.NSAllowsLocalNetworking
   = true`** — permits loopback/local cleartext only; production talks HTTPS to
   `travel.matthewcarr.dev` and is unaffected. (Invalidates the mobile native
   cache key → clean prebuild, correct per TD-009.)
2. **Hardened `resolveBrowserLeg`** to read `EXPO_PUBLIC_E2E_AUTH` at module top
   (a `const`, mirroring `client.ts`'s proven `BASE_URL` read) instead of a
   default param — removes any doubt about bundle-time inlining of the flag.
3. **Added a runner-side seam smoke** (`/start` → `/test-token`) before Maestro:
   proves the server half (E2E_TEST_AUTH gate + mint + DB) independently, so any
   future red journey is unambiguously the client half.

**Triage:** spec deviation (the ATS requirement wasn't anticipated in the SPEC —
add to deviations table at close-out).

### 2026-06-13 — second run still red; both e2e jobs failing

**Step:** CI (run 27461170338)
**Type:** surprise (investigation)
**Note:**

After the ATS commit, *both* `E2E tests` (web Playwright) and `mobile-e2e`
failed.

- **Web `E2E tests`**: `08-trip-stage.spec.ts` — the "Thailand" country
  autocomplete option click timed out. A **web-only flake** unrelated to
  SPEC-014 (my branch touches no web UI; the same job was green on the prior
  run with identical web code). A fresh run re-tests it.
- **`mobile-e2e`**: the **runner-side seam smoke PASSED**
  (`Seam server half OK — minted travelplanner://auth?code=…`), proving the
  server half works end-to-end. `signed-in-journey` still failed: two attempts
  **hung 60s** on `trips-screen-root`, one **crashed in 7s**.

Diagnosis: server is fine; the failure is the **client half**. A 60s hang after
tapping sign-in is an `await` that never resolves — either the real
`WebBrowser` leg opened (flag not selected) or `new URL()` on the long OAuth URL
hung/crashed Hermes (the 7s crash fits a native `new URL` fault that JS
try/catch can't catch). Since I can't run Maestro on Linux, I made the next run
self-diagnosing:

1. **Removed `new URL()`** from `extractState` — parse `state` with
   `URLSearchParams` only (the same primitive `runSignInFlow`'s deep-link parser
   uses; RN's `URL.searchParams` is non-functional and `new URL` can crash
   Hermes natively).
2. **Bundle marker** (`SPEC014_E2E_AUTH_BUNDLE_ON/OFF`): the flag folds to one
   greppable string; a new CI assertion fails the build if `_OFF` is present or
   `_ON` is missing — so the run now *proves* whether `EXPO_PUBLIC_E2E_AUTH`
   inlined and the substitute is wired.
3. **Stronger ATS**: added explicit `127.0.0.1`/`localhost`
   `NSExceptionAllowsInsecureHTTPLoads` domains alongside
   `NSAllowsLocalNetworking`, in case the latter doesn't cover literal loopback.

**Triage:** keep as investigation log; fold the resolved cause into the
deviations table once the marker reveals it.

### 2026-06-13 — third run: marker ON, crash gone, journey still hangs

**Step:** CI (run 27466436294)
**Type:** investigation (root cause narrowed)
**Note:**

The diagnostics paid off:
- `E2E test-auth substitute is wired into the bundle (marker ON)` — the flag
  inlines and the substitute IS selected (so it was never the real Google
  browser leg).
- `Seam server half OK — minted …code=…` — server half good.
- Web `E2E tests` went green — confirms that failure was a flake.
- **All three Maestro attempts are now clean ~75s hangs** on `trips-screen-root`
  — **no more 7s crash**, so dropping `new URL()` fixed the native crash.

Remaining: with the substitute selected and no crash, the journey still hangs
~75s on the first authenticated action. That's an unresolved `await` — almost
certainly the simulator's HTTP request to `127.0.0.1:3000` not completing
(RN `fetch` has no timeout). A 75s hang on loopback is unusual, so rather than
guess a fourth time I added a **decisive split**:
1. `pingBackend()` + an E2E-gated on-mount probe on the sign-in screen renders
   `login-net-ok` / `login-net-fail`; the journey asserts `login-net-ok` BEFORE
   tapping. Pass ⇒ sim reaches backend (hang is in the auth chain); fail ⇒
   sim→backend networking is the blocker.
2. A 15s `AbortController` timeout in the api client so any future hang becomes
   a fast `internal` error instead of a 75s stall.

Cannot run Maestro/iOS from this Linux session, so CI is the only iOS env;
the next run localizes the failure definitively.

**Triage:** investigation; the probe is diagnostic-only (gated behind the E2E
flag) and comes out once the root cause is fixed.

### 2026-06-13 — ROOT CAUSE PROVEN: sim can't reach host loopback

**Step:** CI (run 27467051307) + fix
**Type:** root cause + fix
**Note:**

The reachability probe was decisive: `signed-in-journey` failed on
`Assertion is false: id: login-net-ok is visible` — `pingBackend()` (the app's
fetch to `/api/auth/providers`) **failed**, so the **iOS Simulator cannot
complete an HTTP request to the host's `127.0.0.1:3000`** on the GitHub macOS
runner, even though the runner-side canary + seam smoke reach it fine. Not the
flag, not the browser leg, not the auth chain — pure sim→host networking. This
is the gap SPEC-013's smoke never exercised (it made no API call).

Fix (Matt chose "try the infra fix"): bind the backend to all interfaces and
point the app at the runner's LAN IP — the same approach `pnpm dev:mobile` uses
for physical devices, which can't use the host's loopback either.
- `ci.yml`: new "Detect runner host IP" step (`ipconfig getifaddr en0`) →
  `HOST_IP` in `$GITHUB_ENV`.
- `start-backend.sh`: `next start -H 0.0.0.0` (was `pnpm start`, loopback-only).
- xcodebuild env: `EXPO_PUBLIC_API_BASE_URL=http://${HOST_IP}:3000`.
- canary + seam smoke + bundle-URL assertion: all switched to `${HOST_IP}:3000`
  (the canary now proves the 0.0.0.0 bind answers on the sim's address).
- `AUTH_TRUST_HOST=true` so next-auth accepts the LAN-IP host on
  `/api/auth/providers`.

The `login-net-ok` probe stays as the fast reachability guard; it now proves the
sim reaches `HOST_IP`.

**Triage:** spec deviation (the harness reachability model changed from loopback
to LAN-IP) — record in the deviations table at close-out.
