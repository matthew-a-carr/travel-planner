# Draft Brief — Mobile Sign-In UI + PKCE Flow + Keychain

**Status:** Brief (pre-spec)
**Will become:** SPEC-006
**Parent epic:** [EPIC-001 — iOS App](../epics/EPIC-001-ios-app.md) — slice 6

---

## Idea (one paragraph)

Ship the mobile half of the server-mediated PKCE OAuth flow on
`apps/mobile/`. Replace the placeholder "Hello, Travel Planner" screen
with a sign-in screen carrying a "Sign in with Google" button. Tapping
the button: generates a PKCE verifier + challenge on-device (via
`expo-crypto`), POSTs the challenge to `/api/v1/auth/mobile/start`,
opens the returned Google authorise URL in an in-app browser modal via
`expo-web-browser.openAuthSessionAsync`, awaits the modal returning a
`travelplanner://auth?code=…` deep link, POSTs the one-time code + the
PKCE verifier to `/api/v1/auth/mobile/exchange`, writes the resulting
`access_token` / `refresh_token` / `access_expires_at` triple to iOS
Keychain via `expo-secure-store` under three discrete keys, calls
`GET /api/v1/me` once with the new bearer to prove it works, and
navigates to a placeholder `/signed-in` screen showing the email
returned by `/me`. All five `MobileAuthCallbackError` deep-link reasons
plus the exchange-error envelopes are handled; `access_denied` shows
distinct copy directing the user to the admin; all other failures
collapse to generic "try again" copy with the underlying code carried
in component state for debugging. Pays down TD-002 in the same slice:
the `mobile-e2e` GitHub Actions job stops being a placeholder, builds
the dev-client via `expo prebuild` + EAS Local, boots the iOS Simulator,
and runs the new `sign-in.yaml` Maestro flow.

## Refined scope

**In scope:**

- New `apps/mobile/app/index.tsx` rewritten as the sign-in screen with
  a `login-google-button` testID + the closed-auth 'access_denied'
  error UX.
- New `apps/mobile/app/signed-in.tsx` placeholder screen ("Signed in
  as {email}." plus the `me-screen-placeholder` testID). No sign-out
  affordance — that's slice 7.
- New `apps/mobile/src/auth/` directory housing:
  - `pkce.ts` — `generateVerifier()` + `verifierToChallenge()` using
    `expo-crypto` (base64url SHA-256).
  - `keychain.ts` — `storeTokens()` / `readTokens()` / `clearTokens()`
    over `expo-secure-store` with three keys (`access_token`,
    `refresh_token`, `access_expires_at`). Slice 6 only writes; slice 7
    starts reading on startup.
  - `sign-in-flow.ts` — orchestrates start → openAuthSessionAsync →
    parse deep-link → exchange → store → /me-as-proof. Returns
    `{ status: 'success', email } | { status: 'cancelled' } | { status:
    'error', reason, code }` where `reason ∈ 'access_denied' | 'generic'`
    and `code` carries the underlying API or callback error code.
- New `apps/mobile/src/api/client.ts` — thin `fetch` wrapper:
  `apiPost<TResp>(path, body, responseSchema): Promise<{ ok: true,
  data: TResp } | { ok: false, error: ApiErrorBody['error'] }>` and a
  matching `apiGet`. Reads `EXPO_PUBLIC_API_BASE_URL` (default
  `http://localhost:3000`). Validates response bodies against schemas
  imported from `@travel-planner/shared`; non-2xx envelopes are parsed
  via `apiErrorBodySchema` with a defensive fallback to
  `{ code: 'internal', message: 'Unexpected error.' }` when the
  envelope itself is malformed.
- Three new `apps/mobile/` runtime deps via `expo install`:
  `expo-web-browser`, `expo-crypto`, `expo-secure-store`.
- Coarse 3-state local component state in the sign-in screen:
  `'idle' | 'in_flight' | 'error'`. No React Context, no state library,
  no global auth store. Successful sign-in calls `router.replace('/signed-in?email=...')`.
- Jest + RNTL + msw component tests:
  - Sign-in screen renders the button + testID in idle state.
  - Tapping the button transitions to in_flight (mocked
    `openAuthSessionAsync` returns success → exchange + /me mocked via
    msw → navigation called with the right route).
  - 'access_denied' branch shows the distinct copy.
  - Generic-error branch shows the fallback copy + the error code tag.
  - Cancellation (modal `type: 'cancel'`) returns to idle silently.
  - `apiPost` parses success bodies via the shared schema and parses
    error envelopes via `apiErrorBodySchema`.
- New `apps/mobile/.maestro/flows/sign-in.yaml` flow asserting:
  app launches → sign-in screen renders with `login-google-button` →
  tapping the button opens the OS browser modal (observable as a
  state transition / spinner). Does NOT drive the real Google OAuth
  flow (Google's anti-automation rejects scripted password entry).
- **TD-002 pay-down:** `.github/workflows/ci.yml` `mobile-e2e` job
  ships its real implementation — `expo prebuild`, `eas build --local
  --profile development --platform ios` (or equivalent) to produce a
  dev-client `.app`, boot the iOS Simulator, install the build, and
  `maestro test apps/mobile/.maestro/flows/`. macOS runner, path-filter
  on `apps/mobile/**`. Estimated +5–10 minutes per affected PR run;
  ~$0.40–0.80 macOS-minutes per run.
- `apps/mobile/AGENTS.md` updates: new "Sign-in flow" subsection
  documenting the `apps/mobile/src/auth/` and `apps/mobile/src/api/`
  conventions; "Dev loop" section adds the `EXPO_PUBLIC_API_BASE_URL`
  override note for on-device dev. The partner-device prerequisite at
  the bottom of `apps/mobile/AGENTS.md` is checked off as part of
  slice 6 close-out (or explicitly noted as a known follow-up per
  EPIC §13 Q1 — partner re-enters at EPIC-002).

**Out of scope (deliberately):**

- **Cold-start auth recovery.** Slice 6 doesn't read Keychain at
  launch. Closing and reopening the app shows the sign-in screen
  even if tokens are still in Keychain. Slice 7 wires the read +
  refresh path.
- **Sign-out.** Slice 7 ships the affordance + the Keychain wipe.
- **Refresh-token rotation logic.** Slice 6 never calls
  `/api/v1/auth/mobile/refresh`. The first refresh attempt is slice 7's.
- **The "Hello, {name}" home screen.** Slice 6's `/signed-in`
  placeholder is intentionally minimal — "Signed in as {email}." —
  to give slice 7 a concrete file to fill in.
- **Maestro driving real Google OAuth.** Google's anti-automation
  rejects scripted credentials; the Maestro flow stops at "browser
  modal observable".
- **Sentry mobile.** Slice 9.
- **Universal Links.** Custom scheme (`travelplanner://`) only.
- **Global auth Context / state library.** Single screen consumes
  the in-flight state; no global needed yet.
- **Cancellation telemetry.** Treat user-cancelled flows as a no-op.
- **Network-class differentiation.** No "you're offline" vs
  "server returned 5xx" distinction — both render generic retry copy.
- **iOS-type Google client.** TD-004's transition stays deferred to
  EPIC-002.
- **Android.** Per EPIC §6 + §14 parking lot.

**Out of scope (deferred):**

- Slice 7 will: read Keychain on cold start, call `/me` at launch to
  validate, call `/refresh` when the access token is expired, swap
  the placeholder for the proper "Hello, {name}" + sign-out screen,
  and introduce the global auth Context now that there are multiple
  consumers.
- TD-004 reshapes the mobile-auth wire surface at EPIC-002 time.
  `apiClient.ts` and the schema imports survive the transition; the
  PKCE-on-server-side dance changes shape.

## Acceptance signal

1. From a clean checkout, `pnpm install && pnpm dev` boots the web
   server; in another shell, `EXPO_PUBLIC_API_BASE_URL=http://<lan-ip>:3000
   pnpm dev:mobile` boots Metro and prints a QR code. Scanning the QR
   from Expo Go on the author's iPhone launches a sign-in screen with
   a tappable "Sign in with Google" button (`login-google-button` testID).
2. Tapping the button opens the OS browser modal showing Google's
   OAuth consent screen.
3. After approving in Google, the modal closes automatically; the app
   shows the placeholder `/signed-in` screen displaying the author's
   email address.
4. iOS Keychain contains three values under the app's namespace —
   verifiable via the dev tools or a temporary debug-only screen
   (don't ship the debug screen): `access_token`, `refresh_token`,
   `access_expires_at`.
5. Force-killing the app and reopening it returns to the sign-in
   screen (cold-start recovery is deferred — this is the expected
   slice-6 behaviour).
6. Closing the OAuth modal without completing returns the app to its
   idle state with no error UI.
7. Attempting to sign in with a Google account that isn't pre-approved
   in the DB (or for which an admin hasn't called
   `pnpm auth:bootstrap-admin`) renders the `access_denied` copy
   ("Sign-in is restricted. Ask the app admin to approve your
   account.") with no Keychain write.
8. `pnpm lint && pnpm db:check:migrations && pnpm type-check &&
   pnpm test:unit && pnpm test:integration` all exit 0 from the repo
   root; `pnpm --filter @travel-planner/mobile test` exits 0; the
   new component tests cover the four happy / cancel / generic-error /
   access-denied branches of the sign-in flow.
9. `pnpm --filter @travel-planner/mobile e2e` runs `sign-in.yaml`
   locally against the iOS Simulator and passes.
10. The CI `mobile-e2e` job actually executes `sign-in.yaml` on every
    `apps/mobile/**` PR — no longer a placeholder. TD-002 resolved at
    close-out.
11. Web side still green: every SPEC-001/002/004 integration test
    passes unchanged.

## Alternatives considered and rejected

| Option | Why rejected |
|--------|--------------|
| **`expo-auth-session` for the OAuth dance** (vs `expo-web-browser`) | Built for the client-as-OAuth-client model. Our flow is server-mediated; the iOS app just opens a URL the server told it about. Using `expo-auth-session` here means fighting its abstractions. TD-004 covers the future move when EPIC-002 funds the iOS-type Google client. |
| **`Linking` + `WebBrowser.openBrowserAsync` + global deep-link listener** | More moving parts, brittle on backgrounding / mid-flow app kills, listener has to live in a context. `openAuthSessionAsync` resolves directly to the return URL. |
| **Slice 6 reads Keychain on cold start and wires the full refresh lifecycle** | ~5–6 day spec, no demoable midpoint. Doubles slice 6. Belongs in slice 7 which is dedicated to "authenticated me screen + sign-out" (i.e. the cold-start-with-existing-tokens path). |
| **Slice 6 ships only the OAuth dance; no `/me` call as proof** | Auth that doesn't call an authenticated endpoint isn't proven. If `signAccessToken` / `verifyAccessToken` drift, the bug surfaces in slice 7 looking like a slice 7 problem. ~5 lines of `/me` call now is cheap insurance. |
| **Collapse slice 7 into slice 6** | Slice budgets stop matching; no demoable midpoint between sign-in and full "Hello, {name}" screen. Loses the boundary the epic established. |
| **Single JSON blob in Keychain** (vs three discrete keys) | Loses field-level operations (e.g. slice 7's "delete refresh_token but keep access_token until expiry" pattern). Per-key access matches the wire shape 1:1. |
| **Global `useAuth()` Context from slice 6** | Single consumer (the sign-in screen). Slice 7 will need the Context anyway when sign-out + cold-start lands; building it now means refactoring it then. |
| **Fine-grained sign-in state machine** (`starting` / `awaiting_browser` / `exchanging` / `verifying`) | The OS browser modal covers the UI during the entire middle. Sub-states would only ever flash for ~100ms gaps. Over-engineering for the audience. |
| **Per-code error copy** (10+ strings) | Audience is two people; the only actionable case is `access_denied` (contact admin). Two-bucket copy is correct UX. |
| **`axios` / `ky` HTTP client** | Adds a dep for what `fetch` does fine. The schema-driven validation logic is the substance, identical with either runtime. |
| **Defer TD-002 further** (option (b) of Q10) | The user explicitly directed: pay down debt inside the slice that touches it. Codified as durable-bias in `AGENTS.md`. |
| **Skip Maestro for slice 6 entirely** (option (c) of Q10) | Loses the launch-time + sign-in-button smoke test. Cheap to write; valuable as a regression guard. |

## Open risks

1. **`expo prebuild` + EAS Local dev-client build in CI is unfamiliar
   territory.** TD-002 estimated half-day but the first wiring of an
   EAS Local CI pipeline has unknowns (macOS runner caching of the
   `ios/` directory, signing-cert requirements for dev clients,
   simulator-boot reliability under headless CI). Possible
   mitigation: keep the CI job non-blocking (warning, not failure)
   for the first 1–2 weeks of slice 6 stability while we shake out
   flakes; promote to blocking once it has a track record. Decide
   at SPEC time whether non-blocking is acceptable or whether we
   eat the budget overrun to make it blocking from day one.
2. **`EXPO_PUBLIC_API_BASE_URL` on-device dev requires the LAN IP.**
   The author's iPhone has to reach the Mac's dev server over the
   LAN; this works on a home network but fails on
   captive-portal / coffee-shop networks. Acceptable for slice 6;
   document the workflow.
3. **Google's OAuth consent screen UX inside `SFAuthenticationSession`.**
   First-time sign-in shows an iOS-system "this app wants to use
   Google" warning. Expected behaviour but worth flagging in the
   demo script so it's not mistaken for a bug.
4. **Race between `/exchange` and `/me`.** The use-case-level repo
   commits are sequential, but the access token is technically
   "alive" the moment `/exchange` returns. If `/me` 401s here, it's
   a server-side bug (clock skew, signing-key drift) not a client
   bug — but the client must collapse to generic-error UX and NOT
   persist tokens. Mitigation: only write tokens to Keychain AFTER
   `/me` succeeds. If `/me` fails, treat the whole flow as failed
   and don't persist.
5. **`expo-secure-store` quirks on iOS Simulator vs device.** The
   simulator's keychain is per-simulator-instance and can be wiped
   by Xcode tooling; device keychain persists across builds. Manual
   verification should cover both. Maestro flow only runs against
   simulator.
6. **`pnpm install` adding `expo-*` deps may pull in transitive
   updates that touch `pnpm-lock.yaml` widely.** Watch the lockfile
   diff at step 1; if surprising deps move, halt and consult.
7. **`apps/mobile/src/` is a new directory.** SPEC-003 / ADR 052
   didn't establish a `src/` tree inside the mobile app — everything
   so far lives at `apps/mobile/app/` (routes) and
   `apps/mobile/__tests__/`. Slice 6 introduces non-route logic
   modules (`auth/`, `api/`) and needs a home. Worth confirming
   the layout name at SPEC time. Alternatives: `apps/mobile/lib/`,
   `apps/mobile/modules/`. `src/` matches `apps/web/src/`
   precedent — recommend `src/`.

## Key answers from grilling

**Q1 — Browser primitive.** `expo-web-browser.openAuthSessionAsync` with
`returnUrl = 'travelplanner://auth'`. Resolves directly to the deep-link
return URL or `{ type: 'cancel' }`. No global Linking listener. (User: "a".)

**Q2 — Slice 6 / 7 boundary.** Slice 6 calls `/me` once after `/exchange`
to prove the bearer works, then navigates to a `/signed-in` placeholder
showing the email. Sign-out + full "Hello, {name}" UI + cold-start
recovery stay in slice 7. (User: "b".)

**Q3 — Cold-start behaviour.** Strict. Slice 6 doesn't read existing
Keychain values on launch. Every cold start during the slice-6 window
shows the sign-in screen. Slice 7 wires the read + refresh path.
(User: "a".)

**Q4 + Q5 + Q6 — State container / Keychain shape / API base URL.**
Route navigation only (no Context); three discrete Keychain keys
matching the wire shape; `EXPO_PUBLIC_API_BASE_URL` env var with
`http://localhost:3000` fallback. (User: "yeah go for a".)

**Q7 + Q8 + Q9 — State machine / error UX / HTTP client.** Coarse
3-state local discriminant (`idle` / `in_flight` / `error`); two-bucket
error UX (`access_denied` distinct, everything else collapses);
native `fetch` + thin `apiClient.ts` validating via
`@travel-planner/shared` schemas. (User: "Yeah go with a for all
three".)

**Q10 — Maestro coverage + TD-002.** Pay down TD-002 inside slice 6:
ship the real `mobile-e2e` CI wiring with `expo prebuild` + EAS Local
dev-client + Maestro flow execution. (User: "Yeah go with a and
always align around doing the longer term/more stable approach. Bake
this into agents.md files if not already there.") Durable-bias
directive captured in `AGENTS.md` "Decision-making bias" section.
