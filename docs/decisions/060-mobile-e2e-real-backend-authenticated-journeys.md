# ADR 060: Mobile E2E Phase 2 — Real Backend and Authenticated Journeys in CI

**Date:** 2026-06-12
**Status:** Accepted
**Related:** [ADR 055 — Mobile E2E via Local Dev-Client Build in CI](./055-mobile-e2e-via-eas-local-dev-client-in-ci.md), [ADR 051 — Mobile Authentication Model](./051-mobile-authentication-model.md), [ADR 057 — Autonomous Workflow](./057-autonomous-workflow-and-remote-execution.md), [ADR 059 — Mobile Phase 3: Spend Capture](./059-mobile-phase-3-spend-capture-writes.md), [TD-009](../tech-debt.md)

> Operationalised by [EPIC-004](../epics/EPIC-004-mobile-e2e-authenticated-journeys.md).
> Drafted alongside the epic in the same PR (EPIC-002/003 precedent);
> merging the EPIC-004 PR constitutes acceptance.

## Context

ADR 055 made `mobile-e2e` a real CI job: `expo prebuild` + `xcodebuild`
produce a self-contained Release `.app`, the simulator boots it, and
Maestro drives it. But the job's *coverage* froze at the front door. The
single flow (`sign-in.yaml`) asserts the sign-in screen renders and
deliberately stops there, for two reasons documented in the flow itself:

1. **No backend.** CI runs no server, so any real interaction would
   collapse to the generic "could not reach the server" error. The
   Release build inlines `EXPO_PUBLIC_API_BASE_URL` at bundle time, and
   nothing listens at the default.
2. **No automatable sign-in.** The only auth path is Google OAuth via
   `ASWebAuthenticationSession` (ADR 051's server-mediated PKCE).
   Google's consent screen actively resists automation and there are no
   scriptable test credentials.

Since then the surface behind the front door has grown: EPIC-002 shipped
trips list and trip detail; the me/sign-out journey shipped in SPEC-007;
EPIC-003 (approved) adds the highest-risk UX yet — spend-capture *writes*
with idempotent retry semantics, sheets, and animations. Every one of
those journeys is covered only by jest+RNTL component tests (mocked
fetch, no real navigation container, no real Keychain, no real bundler
boot) plus manual taps on Matt's iPhone before merge. The gap is
structural: the journey layer — what a user actually does, across
screens, against real wire shapes — has no automated proof, and per
ADR 057 the humans-out-of-the-loop workflow leans on CI gates being
*real*.

Two further constraints shape any solution:

- **GitHub macOS runners have no Docker**, so the web app's
  Testcontainers pattern (ADR 009) cannot provision Postgres inside the
  `mobile-e2e` job.
- The job's cost discipline (ADR 055: 4–6 min warm, path-filtered,
  blocking) and flake history (TD-009) mean coverage growth must come
  with explicit runtime and flake budgets, not instead of them.

## Decision

Extend the ADR 055 pipeline — not replace it — so that Maestro drives
the real app against a real backend as a signed-in user:

1. **Real backend in the job.** The `mobile-e2e` job boots the actual
   Next.js app with a real Postgres, migrated and deterministically
   seeded. Postgres is provisioned **natively** on the macOS runner (no
   Docker available); locally, the existing Docker/Testcontainers
   bootstrap is reused. The seam between the two is a `POSTGRES_URL` —
   the orchestration script cares only that one exists. A mock/fixture
   API server was rejected as the default: it is a second implementation
   of the contract that drifts silently; the real app + shared zod
   schemas + migrations give drift nowhere to hide. (The OpenAPI-pinned
   fixture server is retained as EPIC-004's documented *pivot* if the
   real backend proves too slow or too flaky on macOS.)
2. **The app build points at it.** `EXPO_PUBLIC_API_BASE_URL` is set to
   the runner-local server when the Release JS bundle is produced during
   `xcodebuild`. The simulator shares the host network, so localhost
   works without tunnelling.
3. **A test-only auth seam replaces exactly one leg: the browser.**
   Sign-in keeps its real PKCE start, real exchange-code redemption,
   real Keychain writes, real `/me` proof, and real AuthGuard
   navigation. Only the un-automatable
   `ASWebAuthenticationSession`-plus-Google leg is substituted: a
   server-side test-only endpoint mints a genuine one-time exchange code
   for a seeded E2E user through the same machinery as the real flow,
   and an E2E app build (flagged at bundle time) injects a browser-step
   replacement at the existing `runSignInFlow(deps)` seam that calls it.
   The endpoint is **double-gated**: it exists only when an explicit
   env flag (set by the e2e orchestration alone) is true **and** the
   process is not a Vercel deployment, and an integration test asserts
   it returns 404 when the flag is unset. If that gate cannot be made
   provable, the seam approach is killed rather than shipped (EPIC-004
   kill criterion).
4. **Journey-level flows, not edge-case flows.** One Maestro flow per
   user journey (sign-in → list, detail, sign-out; later EPIC-003's
   capture), selecting by `testID` only. State-machine edges,
   loading/error permutations, and formatting stay in jest+RNTL where
   they are cheap. This keeps the macOS minutes spent proportional to
   journeys shipped, not to test-case count.
5. **Budgets and diagnostics are part of the decision.** The job stays
   blocking and path-filtered (`apps/mobile/**` + lockfile/workspace
   config, now also `packages/shared/**` since the wire contract feeds
   the flows; `apps/web/**` deliberately does **not** trigger the macOS
   job — the web's own CI gates the server). Failure artifacts grow to
   include a screen recording and backend logs alongside the Maestro
   report. EPIC-004 carries measurable runtime/flake/cost kill criteria
   inherited from ADR 055's triggers.

## Consequences

**What becomes easier:**

- Regressions in the signed-in journeys — navigation wiring, Keychain
  integration, envelope parsing against the *real* server, cold-start
  auth resolution — are caught by CI instead of by Matt's thumbs.
- EPIC-003's capture slices inherit a harness: their SPECs add a flow
  file and fixtures, not infrastructure.
- The sign-in flow's own comment debt ("CI doesn't run a backend so a
  real tap would produce an error") is paid down; the smoke test
  becomes a journey.
- Local `pnpm test:e2e:mobile` gains the same one-command orchestration
  the web Playwright suite already has, shrinking the manual-validation
  surface before merging mobile PRs.

**What becomes harder:**

- The macOS job gets longer and gains moving parts (Postgres, server
  boot, seeding). Warm-cache target stays ≤ ~10 min median; the web
  app's build/boot strategy on the runner (build+`pnpm start` vs
  `pnpm dev:next`, `.next` caching) is decided in slice 1 with real
  numbers.
- A test-auth seam is a security-sensitive artifact. The double gate +
  404 integration test + "never set on Vercel" rule are load-bearing;
  any weakening is an epic-level deviation, not a slice detail.
- More flows = more flake surface on a runner family with a flake
  history (TD-009). The 3× retry + diagnostics insurance stays; the
  flake kill criterion freezes flow growth if the rate regresses.

**Trade-offs:**

- Could have automated the real Google OAuth (test account +
  driving the system browser). Rejected: Google actively blocks it,
  it would couple mobile flows to web DOM internals, and it reintroduces
  the flakiest possible dependency into a job with a flake history.
- Could have pre-seeded tokens straight into the simulator Keychain and
  skipped sign-in entirely. Rejected: it bypasses the app's real
  exchange/storage/cold-start code — precisely the integration seams
  component tests already can't reach.
- Could have pointed CI at a deployed preview environment instead of a
  runner-local backend. Rejected: couples the mobile gate to Vercel
  deploy timing and preview-branch lifecycle (ADR 039 skips previews for
  bot PRs entirely), adds secrets to the job, and makes failures
  non-reproducible locally.
- Could have adopted a mock API server for speed. Rejected as default
  (contract drift), retained as the documented pivot — the kill
  criterion makes the fallback explicit instead of a quiet rewrite.

**Trigger to revisit:**

- EPIC-004's kill/pivot criteria fire (runtime, flake rate, cost band,
  or an unprovable auth gate).
- ADP funding / TestFlight (the parked phase-4 epic) replaces the
  dev-client build per ADR 055's own revisit trigger — the
  backend-and-auth-seam half of this ADR should survive; re-validate
  the build half then. The same trigger fires TD-004 (native on-device
  OAuth), which reshapes `/api/v1/auth/mobile/*` and with it the test
  seam's server half — re-plan the mint endpoint alongside that work.
- Android (if ever) — the journey-flow inventory transfers; the
  provisioning half is iOS-specific.
