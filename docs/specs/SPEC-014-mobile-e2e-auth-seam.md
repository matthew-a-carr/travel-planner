# SPEC-014: Mobile E2E — Test-Auth Seam + Signed-In Journey

**Date:** 2026-06-13
**Status:** Complete
**Author:** Claude (interactive session)
**Parent epic:** [EPIC-004 — Mobile E2E Phase 2](../epics/EPIC-004-mobile-e2e-authenticated-journeys.md)

> Slice 2 of EPIC-004 — the **milestone** ("past the front door"). Carries
> the epic's **kill criterion** (§9): if the test-auth seam can't be provably
> gated out of production — concretely, if no integration test can assert the
> endpoint is unreachable when the flag is unset — the seam approach is killed
> and the epic closes as Abandoned. This SPEC proves the opposite: a route
> int-test asserts a hard 404 whenever either gate is off.
> Per the EPIC-002 / SPEC-013 precedent and Matt's standing instruction, the
> SPEC ships in the same PR as the implementation (deviation #1).

---

## 1. Summary

The `mobile-e2e` job stops at the sign-in screen because Maestro can't drive
Google's consent screen. This slice replaces **only the browser leg** of the
PKCE dance with a server-minted real exchange code, so CI can sign in as the
seeded e2e user and walk the journey a traveller actually takes: open the app
→ sign in → see the seeded trips → open Profile → sign out → back at sign-in.

The seam has two halves, mirroring ADR 060 §10:

- **Server:** a double-gated `POST /api/v1/auth/mobile/test-token` endpoint
  that, given a live `state` from `/start`, mints a one-time exchange code for
  a seeded approved user keyed to that state's stored PKCE challenge — exactly
  what `/callback` does after Google, minus Google. The endpoint is **404 by
  construction** unless an explicit `E2E_TEST_AUTH` flag is set **and** the
  process is not on Vercel.
- **Client:** the existing `runSignInFlow(deps)` browser-leg seam
  (`deps.openAuthSession`) is selected at bundle time. When
  `EXPO_PUBLIC_E2E_AUTH=1` is inlined, the substitute leg POSTs the `state` to
  `/test-token` and returns the deep link, so the real PKCE start → exchange →
  Keychain → `/me` → AuthGuard path runs unchanged. PKCE generation,
  `/exchange` verification, token storage, and cold-start resolution stay
  **real** — only the human-at-Google step is substituted.

A new Maestro flow drives sign-in → trips list → sign-out and blocks CI. No
product code path changes; the only new runtime surface is the gated endpoint.

## 2. Motivation

EPIC-004 §7 slice 2; strategic rationale in
[ADR 060](../decisions/060-mobile-e2e-real-backend-authenticated-journeys.md)
(auth-seam design, gating discipline, rejected alternatives) and
[ADR 051 §3](../decisions/051-mobile-authentication-model.md) (the PKCE flow
the seam taps). Slice 1 (SPEC-013) built the real backend the journey needs;
this slice is the single highest-leverage unlock — every signed-in journey
behind the front door becomes testable the moment it lands. Resolves the
epic's §13 **deferred Q4** (test-mint endpoint shape, flag name, and how the
minted code links to the live sign-in's PKCE state).

## 3. Acceptance criteria

1. Given `E2E_TEST_AUTH=1` and the process is not on Vercel, when
   `POST /api/v1/auth/mobile/test-token` is called with a live `state`
   (from a prior `/start`), then the server mints a one-time exchange code
   keyed to that state's stored `code_challenge` for the seeded approved e2e
   user and returns `{ data: { redirect_url: 'travelplanner://auth?code=…' } }`
   in the standard 2xx envelope.
2. Given the minted code, when the mobile client redeems it via the **real**
   `POST /api/v1/auth/mobile/exchange` with the verifier that produced the
   challenge, then a valid access + refresh pair is issued — proven by a route
   int-test that chains `/start` → `/test-token` → `/exchange` with no Google
   mock in the exchange path.
3. Given `E2E_TEST_AUTH` is **unset** (or any value ≠ `1`), when
   `/test-token` is called, then the endpoint responds **404 `not_found`** with
   the standard error envelope — indistinguishable from a non-existent route.
   (Kill-criterion proof.)
4. Given the process is on Vercel (`VERCEL=1`), when `/test-token` is called
   **even with `E2E_TEST_AUTH=1`**, then the endpoint still responds **404** —
   the no-Vercel gate overrides the flag.
5. Given a `state` whose user is **not approved** (ADR 029), when
   `/test-token` is called, then the redirect URL carries
   `?error=access_denied` (the seam exercises the same access check as
   `/callback`), and no exchange code is minted.
6. Given an E2E app build (`EXPO_PUBLIC_E2E_AUTH=1`), when `runSignInFlow`
   reaches the browser leg, then `resolveBrowserLeg()` returns the substitute
   that calls `/test-token`; in a normal build it returns
   `WebBrowser.openAuthSessionAsync`. Covered by a unit test on both branches.
7. Given the `mobile-e2e` job, when it runs, then a new Maestro flow
   (`signed-in-journey.yaml`) launches the app, taps Sign in, asserts the
   seeded **Kyoto Adventure** trip renders on the trips list, opens Profile,
   taps Sign out, and asserts the app returns to the sign-in screen — blocking
   the PR. The existing `sign-in.yaml` smoke flow still passes.
8. The double gate is set **only** by the job (`E2E_TEST_AUTH` at job level,
   inherited by the backend server; `EXPO_PUBLIC_E2E_AUTH` in the xcodebuild
   step env so it's inlined into the bundle). Terraform / Vercel env config
   never defines either flag.

## 4. Demo script

1. `mobile-e2e` log: Postgres → migrate/seed → build → server boot → canary →
   bundle assertion → Maestro: `signed-in-journey` launches, taps Sign in,
   lands on the trips list with **Kyoto Adventure**, opens Profile, signs out,
   back at sign-in. Green.
2. `pnpm test:integration -- .../mobile/route.int-test.ts`: `/test-token`
   returns 404 with the flag unset; 404 on Vercel even with the flag set;
   200 + a redeemable code with both gates satisfied; `access_denied` for an
   unapproved user.
3. Locally point a build with `EXPO_PUBLIC_E2E_AUTH=1` at a backend with
   `E2E_TEST_AUTH=1`: tapping Sign in signs straight in, no browser. Without
   the flag the button opens the real Google sheet (unchanged behaviour).

## 5. Out of scope

- **Read-journey assertions on the seeded detail data** (legs, fixed costs,
  spend figures) and the not-found flow — slice 3.
- **Screen-recording diagnostics + `pnpm test:e2e:mobile` local backend
  orchestration + budget validation** — slice 4. (This SPEC's local story is
  "set both flags and point at a backend"; slice 4 automates it.)
- **Write-journey fixture isolation** — slice 5.
- **EPIC-003's spend-capture flow** — written by that epic on this harness.
- Everything in the epic's §6 non-goals (real Google automation, Android,
  devices, ADP, visual regression).

## 6. Prerequisites

- SPEC-013 merged (done) — real backend + deterministic e2e fixtures
  (`E2E_FIXTURES`, approved `mobile-e2e@example.test` user).
- No new accounts, secrets, or services. Two new **non-secret** CI flags.

## 7. Design

### Server — `POST /api/v1/auth/mobile/test-token`

A sibling of the other `/api/v1/auth/mobile/*` routes (the proxy matcher
already excludes `/api/v1`, so it handles its own absence of auth). It is
**deliberately kept off the public OpenAPI surface** — not registered in
`apps/web/scripts/generate-openapi.ts` (resolves epic Q4: a v1-path route for
pipeline simplicity, but unpublished because it's a test backdoor, not a
product contract).

**Double gate** (ADR 060 §10, evaluated per request so the int-test can toggle
env between cases):

```
enabled = process.env.E2E_TEST_AUTH === '1' && (process.env.VERCEL ?? '') !== '1'
```

When `!enabled` → `respondWithError(request, 'not_found', …)` (404). No body
parsing, no DB access — the route is invisible.

When enabled, it delegates to a new use case `makeMintTestExchangeCode` that
**reuses the existing repos + crypto** from `getAppContainer()`:

1. Parse body `{ state, email? }` (zod, shared schema). Default `email` to
   `E2E_FIXTURES.user.email` (the route supplies the default — `E2E_FIXTURES`
   lives in infrastructure; `app/` may import it).
2. `stateRepo.findByState(state)` — missing / consumed / expired →
   `redirect_url = travelplanner://auth?error=invalid_state`.
3. `userAccessRepo.findByEmail(email)` — `!isApproved` →
   `?error=access_denied` (ADR 029 parity; no code minted).
4. `stateRepo.markConsumed(state)` (single-use, like `/callback`).
5. Mint cleartext code + sha256 hash, `exchangeCodeRepo.create({ codeHash,
   codeChallenge: stateRow.codeChallenge, userId, expiresAt })`.
6. Return `redirect_url = travelplanner://auth?code=<cleartext>`.

The use case is structurally `handle-mobile-callback` minus the Google
exchange — the same TTL, the same one-time-code minting, the same deep-link
contract — so the substitute browser leg returns the **identical** URL shape
the real `/callback` 302-redirects to, and `runSignInFlow` can't tell the
difference. It lives at
`src/application/use-cases/auth/mobile/mint-test-exchange-code.ts` with a
co-located `.int-test.ts` (application-layer rule).

**Wire schemas** (`packages/shared/src/mobile-auth.ts`, exported but **not**
added to the OpenAPI registry):

```ts
mobileAuthTestTokenRequestSchema  = z.object({ state: z.string().min(1),
                                               email: z.string().email().optional() })
mobileAuthTestTokenResponseSchema = z.object({ redirect_url: z.string().min(1) })
```

### Client — browser-leg selection

`runSignInFlow(deps)` already injects `deps.openAuthSession`. New module
`apps/mobile/src/auth/e2e-browser-leg.ts`:

- `e2eOpenAuthSession(authoriseUrl)` — extracts `state` from `authoriseUrl`'s
  query, `apiPost('/api/v1/auth/mobile/test-token', { state },
  mobileAuthTestTokenResponseSchema)`, returns `{ type: 'success', url:
  data.redirect_url }`. On any failure returns `{ type: 'success', url:
  'travelplanner://auth?error=server_error' }` so the flow surfaces a loud
  error instead of hanging. Typed as `typeof WebBrowser.openAuthSessionAsync`.
- `resolveBrowserLeg(flag = process.env.EXPO_PUBLIC_E2E_AUTH)` — returns
  `e2eOpenAuthSession` when `flag === '1'`, else
  `WebBrowser.openAuthSessionAsync`. The `flag` param keeps it unit-testable
  without depending on Expo's bundle-time `EXPO_PUBLIC_*` inlining.

The sign-in screen swaps its hardcoded
`openAuthSession: WebBrowser.openAuthSessionAsync` for
`openAuthSession: resolveBrowserLeg()`. No other screen logic changes; the
component test still injects deps directly, so it's unaffected.

### CI — `mobile-e2e` (`.github/workflows/ci.yml`)

- Job-level env gains `E2E_TEST_AUTH: '1'` — inherited by the backend server
  (`start-backend.sh` runs `pnpm start` in the job env), enabling
  `/test-token` for the live server only.
- The xcodebuild step env gains `EXPO_PUBLIC_E2E_AUTH: '1'` beside the existing
  `EXPO_PUBLIC_API_BASE_URL`, so the Release bundle inlines the substitute
  selection. (Both are non-secret CI-only flags; neither exists in Terraform
  or any Vercel environment — gate #2 is belt to gate #1's braces.)
- New flow `apps/mobile/.maestro/flows/signed-in-journey.yaml` (testID
  selectors only, per convention): launch → wait `login-screen-root` → tap
  `login-google-button` → wait `trips-screen-root` → assert
  `trips-screen-item-<Kyoto trip id>` → tap `trips-screen-profile` → wait
  `me-screen-sign-out` → tap it → wait `login-screen-root`.

### Storage & migrations

N/A — no schema change. The endpoint writes to the existing
`mobile_auth_exchange_codes` / `mobile_auth_states` tables via existing repos.

### External integrations

None. Google is the one boundary the seam removes; everything else is real.

## 8. Security & data considerations

- `/test-token` is a **deliberate auth backdoor**, so its gating is the
  security surface, not an afterthought. Two independent gates, both
  **fail-closed**: the flag must be exactly `'1'` *and* the process must not be
  on Vercel. AC3 + AC4 are the regression tests that keep both honest; AC3 is
  the epic's literal kill-criterion proof.
- The flags live only in `ci.yml` (a non-secret, throwaway CI value). They are
  never defined in Terraform, Vercel env, or `.env*`. A grep for
  `E2E_TEST_AUTH` / `EXPO_PUBLIC_E2E_AUTH` outside `ci.yml`, this SPEC, and the
  code that reads them should return nothing.
- Even if the endpoint were somehow reachable, it only mints a code for a
  **pre-seeded, pre-approved** user against a **live `state` the caller must
  already have created** via `/start` — it grants no access that the normal
  flow wouldn't, for any user that doesn't already exist and isn't approved.
  The exchange code is still one-time, hashed, and 120s-TTL.
- The client substitute ships in the bundle only when the flag is inlined, and
  is inert otherwise; it calls an endpoint that 404s everywhere but the e2e
  job, so shipping it carries no risk.
- Threats considered: backdoor reachable in prod (gated, tested 404);
  unapproved user minting a session (access check retained, AC5); stale/replayed
  state (single-use + TTL, inherited from `/callback`).

## 9. Test plan

### E2E (Maestro)

| Test file | Scenario |
|---|---|
| `.maestro/flows/signed-in-journey.yaml` (new) | Launch → sign in via the seam → trips list shows Kyoto Adventure → Profile → sign out → back at sign-in |
| `.maestro/flows/sign-in.yaml` (unchanged) | Launch smoke still green behind the live backend |

### Integration (Vitest + Testcontainers)

| Test file | What it covers |
|---|---|
| `…/auth/mobile/mint-test-exchange-code.int-test.ts` | Mints a code keyed to the state's challenge for an approved user; invalid/consumed/expired state → `invalid_state`; unapproved user → `access_denied`, no code row; marks state consumed |
| `…/api/v1/auth/mobile/route.int-test.ts` (extended) | `/test-token`: 404 when `E2E_TEST_AUTH` unset; 404 on Vercel even when set; 200 + redeemable code with both gates; chained `/start`→`/test-token`→`/exchange` issues real tokens; `access_denied` redirect for unapproved |

### Unit (Jest + RNTL, mobile)

| Test file | What it covers |
|---|---|
| `__tests__/auth/e2e-browser-leg.test.ts` | `resolveBrowserLeg('1')` → substitute; `resolveBrowserLeg(undefined)` → real; substitute extracts `state`, calls `/test-token`, returns the deep link as a `success` result; endpoint failure → `?error=server_error` success URL |

### Manual checks

- `workflow_dispatch` (mobile=true) on the branch is green, including the new
  flow — the run IS the verification for the CI half.
- Record the runtime delta for the epic's budget checkpoint (slice 4 owns the
  formal 10-PR measurement; this slice notes the single-run delta).

## 10. Observability

CI-only behaviour change. The job log groups the new flow; a `/test-token`
failure surfaces via the existing backend-log artifact (slice 1). No new
product telemetry.

## 11. Rollback / safety

Revert the PR — the seam endpoint, the flags, and the journey flow all vanish
together; the job returns to SPEC-013's smoke-only shape. No schema change, no
production surface (the endpoint 404s everywhere but the e2e job by
construction).

## 12. Implementation order

1. [ ] **Intent:** shared `test-token` request/response schemas (+ exports),
   NOT registered in the OpenAPI generator. **Verification:** `pnpm
   --filter @travel-planner/shared test`; `pnpm openapi:check` clean (no new
   path).
2. [ ] **Intent:** `mint-test-exchange-code` use case + `.int-test.ts` (red →
   green). **Verification:** `pnpm test:integration -- mint-test-exchange-code`.
3. [ ] **Intent:** `/test-token` route + double gate; extend
   `route.int-test.ts` with the four gate/redeem cases. **Verification:**
   `pnpm test:integration -- mobile/route.int-test`.
4. [ ] **Intent:** mobile `e2e-browser-leg.ts` + unit test; wire the sign-in
   screen to `resolveBrowserLeg()`. **Verification:** `pnpm test:mobile`;
   `pnpm type-check:mobile`.
5. [ ] **Intent:** `signed-in-journey.yaml`; wire `E2E_TEST_AUTH` (job) +
   `EXPO_PUBLIC_E2E_AUTH` (xcodebuild) into `ci.yml`. **Verification:**
   `workflow_dispatch` mobile run green.
6. [ ] **Intent:** docs — SPEC-014 + specs README row, EPIC-004 slice table /
   ledger / §13 Q4, mobile `AGENTS.md` (new flow + seam note), `CHANGELOG`,
   implementation notes. **Verification:** `sync-docs` pass.

## 13. ADR triggers and tech-debt review

### ADR?

- [x] CI pipeline structural change — the seam + flags extend ADR 060's
  already-decided design (its §10 specifies exactly this double-gated
  server-mint + bundle-flag injection). Epic §16 slice 2: "None expected — the
  seam design is settled in ADR 060; a deviation from the double-gate model
  would need an ADR-level rethink." This SPEC implements the model as
  specified. **None required.**
- [ ] New library / external tool / vendor — none.
- [ ] New project-wide standard — none.
- [ ] Non-obvious architectural trade-off — settled in ADR 060.

**ADRs to write:** none.

### Tech debt

- [x] Reviewed `docs/tech-debt.md`. **TD-004** (native on-device OAuth): the
  seam's server half taps `/api/v1/auth/mobile/*`, which TD-004 reshapes when
  ADP is funded — the `/test-token` endpoint will need rework under TD-004's
  flow (recorded in ADR 060's revisit triggers; no action now). **TD-009**
  (mobile-e2e flake/cache): the new flow adds one journey to the existing
  Maestro run under the unchanged retry/cache discipline — no cache key or
  `--clean` logic touched. **TD-003** (SDK 54): no native module added (the
  substitute is pure TS over the existing `apiPost`). No items resolved or
  added.

**Tech debt addressed:** none (constraints respected, not extended).

## 14. Risks & open questions

Decisions taken by best guess (each names the rejected alternative + the cost
of being wrong):

- **Endpoint lives at a v1 path but is unpublished (epic Q4):** rejected a
  non-`/api/v1` internal route (would need its own middleware-exclusion +
  envelope wiring; the v1 path inherits all of it). Cost if wrong: a future
  reader greps the OpenAPI YAML, doesn't find it, and is briefly confused —
  mitigated by the route comment + this SPEC + the AGENTS.md note.
- **Substitute returns `?error=server_error` on endpoint failure** rather than
  a `cancel`/`dismiss` result: rejected silent cancel (would make a broken
  seam look like a user backing out, masking CI failures). Cost if wrong:
  none material — a real failure surfaces loudly, which is the goal.
- **Optional `email` on the wire, defaulting to the fixtures user:** rejected
  hardcoding the fixtures user with no override (the unapproved-user AC5 test
  wants to point at a different seeded user). Cost if wrong: a trivially-unused
  field — but it's the cheapest way to test the access-check branch.
- **Per-request env evaluation for the gate** (not module-load): chosen so the
  route int-test can toggle `E2E_TEST_AUTH` / `VERCEL` between cases in one
  process. Cost if wrong: a negligible `process.env` read per call on a
  test-only endpoint.
- **Risk:** the substitute leg depends on the `authorise_url` carrying a
  parseable `state` query param. It does (the real Google URL includes it, and
  `/start` returns `state` separately too). Mitigated: if `state` is absent the
  substitute returns the `server_error` URL and the flow fails loudly.

---

## Implementation Deviations

| # | Deviation | Reason | Impact | Resolved? |
|---|-----------|--------|--------|-----------|
| 1 | SPEC + implementation in one PR on the session branch | Matt's standing instruction; EPIC-002 / SPEC-013 precedent | Single review gate | Yes (authorised) |

### Post-Implementation Notes

_Filled at close-out._
