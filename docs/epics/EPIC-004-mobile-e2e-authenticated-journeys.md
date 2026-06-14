# EPIC-004: Mobile E2E Phase 2 — Authenticated Journeys Against a Real Backend

**Date:** 2026-06-12
**Status:** Approved
**Strategic ADR:** [060 — Mobile E2E Phase 2: Real Backend and Authenticated Journeys in CI](../decisions/060-mobile-e2e-real-backend-authenticated-journeys.md)
**Owner:** Matt Carr
**Approved by:** Matt Carr, 2026-06-12 (PR #145 review; §13 decisions taken on recommendation stand, including decision 4's reciprocal EPIC-003 amendment)

> Drafted in an interactive Claude Code Web session ("ideate and plan the
> next epic of work for the mobile app E2E", issue
> [#144](https://github.com/matthew-a-carr/travel-planner/issues/144)).
> The epic-altitude grilling pass ran without Matt in the loop; §13
> records every decision taken on recommendation. Wrong calls get
> epic-level deviations, not silent rework.

---

## 1. Vision

A mobile PR goes red because the trip detail screen stopped rendering its
spend summary — and nobody had to pick up a phone to find out. The
`mobile-e2e` job builds the real app pointed at a real backend running on
the runner, signs in as a seeded user (no Google, no human), walks the
journeys a traveller actually takes — open the app, see your trips, open
Kyoto, check the numbers, sign out — and when it fails, hands back a
screen recording and the server logs instead of a shrug. By the end of
the epic, EPIC-003's capture sheet can land with a Maestro flow proving
"type 9.40, tap Food, Save, the figure ticks up" on day one, because the
harness is already there.

## 2. Why now

Coverage froze at the front door while the app grew rooms behind it.
`sign-in.yaml` still only asserts the launch screen renders — it predates
trips list, trip detail, and sign-out, all of which ship today with
component tests plus manual thumbs as their only journey proof. EPIC-003
is approved and brings *writes* with idempotent-retry UX — the costliest
place yet for an uncaught journey regression — and its slices will either
inherit a working authenticated harness or each pay a retrofit tax.
ADR 057 removed the human from the loop on the implementation side, which
makes the CI gates the only eyes most PRs ever get; a gate that can't get
past sign-in isn't watching the part of the app users touch. See ADR 060
for the full analysis.

## 3. Definition of done

- [ ] The `mobile-e2e` job boots a migrated, deterministically seeded
      Postgres + the real Next.js server on the macOS runner, and the
      app build's `EXPO_PUBLIC_API_BASE_URL` points at it.
- [ ] Maestro signs in without Google via the test-auth seam, exercising
      the app's real PKCE-exchange → Keychain → `/me` → AuthGuard path.
- [ ] Journey flows exist and block CI for: sign-in → trips list;
      trip detail; sign-out. The not-found state is covered by a flow
      **or** an explicitly recorded RNTL-only decision (§13 Q5).
- [ ] The test-auth seam is double-gated (explicit env flag + never on
      Vercel) and an integration test proves the endpoint 404s when the
      flag is unset.
- [ ] A failed run uploads Maestro report + simulator screen recording +
      backend logs (7-day retention).
- [ ] `pnpm test:e2e:mobile` runs the same flows locally with one
      command, orchestrating the backend automatically.
- [ ] Median warm-cache job runtime ≤ ~10 min, validated over the first
      10 affected PRs after **both** slices 3 and 4 have landed (slice 4
      owns the measurement; the gate counts only runs that include
      slice 3's flows); flake + cost stay inside §9's bands.
- [ ] A documented flow-authoring pattern (fixtures, testIDs, isolation
      rules for mutating flows) that EPIC-003's slices consume without
      new infra work.

## 4. Demo script

1. Open a mobile PR; watch the `mobile-e2e` job: Postgres comes up,
   migrations + seed run, the server boots, the app builds against it.
2. Maestro launches the app → sign-in screen → invokes the E2E sign-in →
   lands on the trips list showing the seeded trips.
3. The flow opens the seeded "Kyoto" trip → asserts destination legs,
   fixed costs, and the spend summary render with the seeded figures.
4. A flow deep-links to a non-existent trip id → asserts the not-found
   state (or, if §13 Q5 resolves to RNTL-only, this line is
   demonstrated in the component suite instead).
5. Back on the list → profile → sign out → back at the sign-in screen.
6. Break a screen on purpose → the job fails → download the artifact:
   screen recording shows the failure, backend log shows the requests.
7. Run `pnpm test:e2e:mobile` on a Mac → the same flows run locally,
   backend orchestrated automatically, no manual setup.
8. (Post-EPIC-003 slice 2) The capture-sheet flow records a spend and
   asserts the figures tick up — written by that slice, on this harness.

## 5. Outcome / success criteria

1. Every shipped signed-in journey (and every future one) has a blocking
   CI flow driving the real app against the real server — the class of
   regression that today only manual device testing catches gets caught
   by CI.
2. The sign-in journey is covered end-to-end except the Google browser
   leg — exchange, Keychain, cold-start resolution, and sign-out run for
   real on every affected PR.
3. Everything EPIC-003's capture slice needs to land with a flow —
   harness, write-capable fixtures, isolation pattern, authoring docs —
   is ready before that slice starts implementation (the flow itself is
   EPIC-003's to write; see §13 decision 4 for the proposed EPIC-003
   amendment).
4. The job stays affordable and trustworthy: ≤ ~10 min median warm,
   flake ≤ 1 in 5 on `main`, cost within ~2× ADR 055's band.
5. A red `mobile-e2e` run is debuggable from artifacts alone — no
   "re-run and hope", no local repro required to form a hypothesis.

## 6. Non-goals

- **Automating real Google OAuth.** The browser leg stays untested by
  Maestro, permanently and on purpose (ADR 060 trade-offs).
- **Android.** No Android app exists; nothing here may assume one.
- **Physical-device automation.** Simulator only; Matt's iPhone remains
  the (shrinking) manual loop.
- **Visual-regression / screenshot diffing.** Parked (§14) — relevant to
  EPIC-003's polish slice, but a different tool decision.
- **Performance testing.** Flows assert behaviour, not timing budgets.
- **TestFlight / ADP / EAS Build.** Distribution unchanged (ADR 055's
  revisit trigger owns that).
- **Web Playwright changes.** The web e2e stack is out of bounds except
  for sharing fixture definitions where free.
- **Writing EPIC-003's spend-capture flows.** This epic builds the
  harness and the pattern; the capture slices own their flows (§7
  slice 5 is readiness + handoff, not their tests).

## 7. Vertical slices

| # | Slice | Demo script line(s) | Becomes SPEC | Depends on | Status |
|---|-------|---------------------|--------------|------------|--------|
| 1 | **Real backend in the loop** — native Postgres on the macOS runner + migrate + deterministic e2e seed + real server boot + app bundle pointed at it; existing smoke flow proves the app launches clean against a live backend; runtime baseline recorded | 1 | [SPEC-013](../specs/SPEC-013-mobile-e2e-real-backend.md) (Complete) | — | Complete |
| 2 | **Past the front door** (**milestone**) — server test-mint endpoint (double-gated) + E2E build's browser-leg injection at the `runSignInFlow(deps)` seam + 404 gate integration test + full sign-in → trips list → sign-out journey flow | 2, 5 | [SPEC-014](../specs/SPEC-014-mobile-e2e-auth-seam.md) (Complete) | 1 | Complete |
| 3 | **Read-journey coverage** — trip detail flow against the seeded Kyoto trip (legs, fixed costs, spend summary) + not-found flow + list↔detail navigation assertions | 3, 4 | _not yet planned_ | 2 | Not started |
| 4 | **Diagnostics + local parity** — simulator screen recording + backend log artifacts on failure; `pnpm test:e2e:mobile` one-command local orchestration; budget validation over first 10 PRs; flow-authoring docs in mobile `AGENTS.md` | 6, 7 | _not yet planned_ | 2 | Not started |
| 5 | **Write-journey readiness** — fixture isolation/reset strategy for mutating flows (unique-per-run data vs reseed), write-capable seed fixtures, pattern handoff so EPIC-003 slice 2 lands with a capture flow | 8 (enables) | _not yet planned_ | 3 | Not started |

> SPECs are drafted lazily (one `ai:plan` issue per slice). Slice 4
> can run parallel to slice 3. Slice 5 should land before EPIC-003's
> capture sheet (its slice 2) reaches implementation.

## 8. Sequencing rationale

Slice 1 is the cliff: if a real backend can't run green and affordably on
a Docker-less macOS runner, the epic pivots before any flow is written —
so it goes first and carries the pivot criterion. Slice 2 is the
milestone because the auth seam is the single highest-leverage unlock:
every journey behind it becomes testable the moment it lands, and its
one flow already covers sign-in, list render, and sign-out. Slice 3 is
pure coverage on settled infrastructure. Slice 4 is deliberately after
the first real flows exist (diagnostics tuned against real failures, not
imagined ones) but parallelisable with slice 3. Slice 5 is last because
isolation strategy is best designed against the write semantics EPIC-003
slice 1 will have settled by then — and it must beat EPIC-003 slice 2 to
implementation, which the slice table makes an explicit cross-epic edge.

## 9. Kill / pivot criteria

- **Pivot (slice 1):** if the real backend can't run green on the macOS
  runner within ~2 focused days of effort, or adds > 5 min to the median
  warm-cache job after caching levers are applied → pivot to an
  OpenAPI-pinned fixture server (contract-checked against
  `docs/openapi/v1.yaml`) and amend ADR 060.
- **Kill (slice 2):** if the test-auth seam cannot be provably gated out
  of production — concretely: no integration test can assert the
  endpoint is unreachable when the flag is unset, or the flag would need
  to exist in any Vercel environment → kill the seam approach, revert to
  launch-smoke-only coverage, close the epic as Abandoned with the
  failure documented.
- **Freeze:** if `mobile-e2e` flake rate on `main` exceeds ~1 in 5 runs
  over any 2-week window after a slice lands → no new flows until it's
  back under (inherits ADR 055's trigger; TD-009 history applies).
- **Stop-adding:** if median macOS spend per affected PR exceeds ~2×
  ADR 055's $0.40–0.80 band (> ~$1.60) measured after slice 3 → stop
  adding flows; the sharding / self-hosted-runner decision must happen
  before slice 5 proceeds.

## 10. Cross-cutting decisions

| Concern | Decision | Why |
|---------|----------|-----|
| Backend fidelity | Real Next.js server + real Postgres in the job; mock/fixture API server is the documented pivot, never the quiet default | Second implementations of the contract drift silently; migrations + shared zod schemas give drift nowhere to hide (ADR 060) |
| Postgres provisioning | Native Postgres on the macOS runner (no Docker there); locally reuse the existing Docker/Testcontainers bootstrap. The seam is "a `POSTGRES_URL` exists" — orchestration scripts must not care which path produced it | macOS GitHub runners have no Docker; local Macs do, and the web stack already owns that path |
| Auth seam | Replace **only the browser leg**: server test-mint endpoint issues a real one-time exchange code for the seeded e2e user via the production code path; E2E app build injects the substitute at the existing `runSignInFlow(deps)` seam. PKCE start, exchange, Keychain, `/me`, AuthGuard all stay real | Maximum real-code coverage per ADR 060; rejected alternatives (Google automation, Keychain pre-seed, preview-env pointing) recorded there |
| Auth seam gating | Double gate: explicit `E2E_TEST_AUTH`-style env flag set only by e2e orchestration, **and** hard-disabled whenever the process runs on Vercel; integration test asserts 404 when unset; Terraform/Vercel env config never defines the flag | A test backdoor is security-sensitive; the gate must be provable, not conventional — kill criterion if it can't be |
| E2E app build flag | Bundle-time `EXPO_PUBLIC_*` flag selects the injected browser leg; same prebuild/xcodebuild pipeline, no second app target | One pipeline to cache and maintain. ADR 055's cache keys are expected to stay valid because the JS bundle is regenerated per build — §13 Q3 verifies this in slice 1, and the keys gain the env if it resolves "no" |
| Fixtures | One deterministic e2e seed (org + approved e2e user + a multi-destination "Kyoto-style" trip with fixed costs and spend), shared with web Playwright fixtures where shapes allow; flows assert seeded values exactly | Deterministic assertions over "something rendered"; shared fixtures keep the two e2e suites telling one story |
| Flow granularity | One Maestro flow per user journey, `testID` selectors only (existing convention); loading/error/formatting edges stay in jest+RNTL | macOS minutes scale with journeys, not test cases; testIDs already load-bearing per mobile AGENTS.md |
| Mutating-flow isolation | Read flows share the seed; write flows (slice 5 onward) use unique-per-run data or explicit reseed — decided in slice 5 with EPIC-003's write semantics on the table, recorded as the pattern all future write flows inherit | Premature isolation design without real write endpoints is guesswork |
| CI path filter | Unchanged `apps/mobile/**` + lockfile/workspace triggers, **plus `packages/shared/**`** (wire contract feeds the flows); `apps/web/**` does NOT trigger the macOS job. Note: the shared trigger also fires mobile-typecheck/unit-test (desirable — they consume the same contract) | Web changes are gated by the web's own CI incl. Playwright; paying ~10× Linux cost to re-test the app on server-side refactors inverts the cost model |
| Diagnostics | On failure: Maestro report (existing) + simulator screen recording + backend stdout/stderr, 7-day retention | §5.5 — red runs debuggable from artifacts alone |
| Budget & blocking | Job stays blocking; ≤ ~10 min median warm; 3× retry insurance stays; validation checkpoint after 10 affected PRs (ADR 055 pattern) | Coverage growth must not relitigate ADR 055's discipline |

## 11. External dependencies & constraints

| Dependency | What we rely on | Constraint / status |
|------------|-----------------|---------------------|
| GitHub macOS runners | Native Postgres availability (Homebrew or preinstalled), simulator, Xcode — no Docker | Runner-image software set drifts across image versions; slice 1 pins what it uses |
| Maestro CLI | Flow runner + report output (in use today); `openLink` newly required from slice 3's deep-link flow | Version pinned via the existing `~/.maestro` cache key |
| Expo SDK 54 set | No new native modules anticipated; anything outside the set needs an ADR | TD-003 pin stands |
| EPIC-003 | Slice 5's isolation design wants slice-1-of-EPIC-003's write semantics settled; EPIC-003 slice 2 consumes the harness | Cross-epic sequencing recorded in §7/§8; the reciprocal flow obligation on EPIC-003 needs Matt's sign-off (§13 decision 4) |
| TD-004 (native on-device OAuth) | The auth seam's server half taps `/api/v1/auth/mobile/*`, which TD-004 reshapes when ADP is funded | Seam's mint endpoint needs rework under TD-004's flow; recorded in ADR 060's revisit triggers |

## 12. Cost & budget

| Item | Cost | When incurred | Decision |
|------|------|---------------|----------|
| Engineering | ~8–12 focused days across 5 slices | — | This epic |
| macOS CI minutes | +~2–4 min per affected PR over ADR 055's band (backend boot + extra flows), capped by §9's ~2× band | Per mobile-touching PR | Accepted within band; sharding/self-hosted decision forced if exceeded |
| Infra / vendors | £0 incremental — no new accounts or services | — | — |

## 13. Open questions

Two tiers, per the autonomous flow: decisions **taken on recommendation**
while drafting (review these — each names the rejected alternative and
the cost of being wrong), then questions **deliberately deferred** to a
slice.

### Decisions taken on recommendation (review in PR)

| # | Decision taken | Rejected alternative | Cost if wrong |
|---|----------------|----------------------|---------------|
| 1 | Real backend on the runner as the default architecture | OpenAPI-pinned fixture server (faster, no DB) | Slice 1 budget burned before the pivot criterion fires (~2 days, capped) |
| 2 | Auth seam = server-minted real exchange code + injection at the `runSignInFlow(deps)` browser leg, selected by a bundle-time `EXPO_PUBLIC_*` flag | (a) Maestro driving the `ASWebAuthenticationSession` web content; (b) pre-seeding the simulator Keychain; (c) deep-linking a callback URL into a cold app | Slice 2 rework if the deps seam proves awkward in the Release bundle; the *server* half (real minted code, double gate) survives any client-side reshape |
| 3 | `apps/web/**` does not trigger `mobile-e2e`, even though the backend now runs inside it; `packages/shared/**` added instead | Triggering on web changes too (full contract safety, ~10× cost multiplier on every web PR) | A web-side regression that passes web CI but breaks the mobile journey reaches `main` undetected until the next mobile PR — bounded by shared-schema + web integration coverage |
| 4 | Slice 5 (write readiness) lives here; EPIC-003's slices own their actual flows. **Requires a reciprocal EPIC-003 amendment** (its slice 2 gains "lands with a Maestro capture flow on the EPIC-004 harness" — today EPIC-003 commits to no such thing, so the sequencing edge exists only on this side). Recommend Matt approves that one-line amendment to EPIC-003 §7 when merging this PR; until then §5.3 is scoped to what this epic controls | Folding spend-capture flows into this epic | Ownership ping-pong if EPIC-003 slice 2 starts before slice 5 lands — mitigated by the explicit sequencing edge in §7 + the proposed amendment |
| 5 | This work is an epic (5 slices, hard sequencing, kill criteria, security-sensitive cross-cutting decision) despite being developer-facing rather than end-user-facing | One fat SPEC | Process overhead if the slices collapse; cheap to merge slices at SPEC-drafting time |

### Deferred to a slice

| # | Question | Owner | Answer by slice |
|---|----------|-------|-----------------|
| 1 | Server boot mode on the runner: `pnpm build` + `pnpm start` (prod-like, cacheable `.next`) vs `pnpm dev:next` (no build step) — decide on measured runtime | slice SPEC | 1 — **resolved (SPEC-013): `pnpm build` + `pnpm start`, `.next/cache` cached; `dev:next` is the documented fallback if the build busts the budget** |
| 2 | Exact Postgres provisioning (preinstalled vs `brew install`, `initdb` location, version pin vs runner default) | slice SPEC | 1 — **resolved (SPEC-013): newest preinstalled Homebrew keg, `brew install postgresql@16` fallback, `initdb` in `$RUNNER_TEMP`, no version pin** |
| 3 | Does the Release `xcodebuild` re-bundle JS on every run with the cached DerivedData, so `EXPO_PUBLIC_*` changes always take effect? (Believed yes — bundle phase runs per build; must be verified, else cache keys need the env folded in) | slice SPEC | 1 — **resolved (SPEC-013): asserted on every run — the job greps the built bundle for the URL, so a skipped bundle phase fails loudly instead of going stale** |
| 4 | Test-mint endpoint shape and flag name (route under `/api/v1/auth/mobile/` vs a non-v1 internal route — keep it out of the public OpenAPI surface?) — including how the minted code links to the **live sign-in's PKCE state/challenge** so the real `/exchange` verification passes (ADR 051 §3): the injected browser leg must convey the `state` from the start step to the mint endpoint | slice SPEC | 2 — **resolved (SPEC-014): `POST /api/v1/auth/mobile/test-token` (a v1 path for free middleware/envelope wiring, but deliberately unpublished from the OpenAPI surface — it's a backdoor, not a contract). Flags: server `E2E_TEST_AUTH=1` + bundle-time `EXPO_PUBLIC_E2E_AUTH=1`, both CI-only. The substitute browser leg parses `state` from the `authorise_url` it's handed and POSTs it to `/test-token`, which looks up the state row's stored `code_challenge` and mints a one-time code keyed to it — so the real `/exchange` verifies the client's verifier unchanged. Proven by a chained `/start`→`/test-token`→`/exchange` int-test.** |
| 5 | Whether the not-found journey warrants a flow or stays RNTL-only once flow-count cost is visible | slice SPEC | 3 |
| 6 | Mutating-flow isolation: unique-per-run entities vs reseed-between-flows (wants EPIC-003 slice 1's idempotency semantics settled) | slice SPEC | 5 |

## 14. Parking lot

- **Visual-regression screenshots** (dark-mode diffs would serve EPIC-003
  slice 5's audit) — separate tool decision, possibly its own SPEC.
- **Device matrix** (iPhone SE width, larger Dynamic Type in flows) —
  one device today; matrix multiplies minutes.
- **Maestro Cloud / flow sharding** — becomes relevant if §9's cost
  criterion fires.
- **Self-hosted Mac runner** — same trigger; also flagged in ADR 055.
- **Android journey flows** — if an Android app ever exists, the flow
  inventory transfers; provisioning is iOS-specific.
- **Reusing the test-auth seam for local manual testing** (sign in on
  the simulator without Google) — possible quality-of-life spillover;
  needs the same gate discipline.

## 15. Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| macOS-native Postgres provisioning is fiddly / runner-image drift breaks it | Medium | Slice 1 overrun, recurring CI breakage | Pin versions in slice 1; pivot criterion caps the spend; fixture-server fallback documented |
| Test-auth seam gating judged insufficient | Low | Security exposure or epic killed | Double gate + 404 integration test + no-Vercel rule designed in before code; kill criterion honoured |
| Job runtime creeps past budget as flows accumulate | Medium | Cost band breached, slower mobile PRs | §9 stop-adding criterion; journey-granularity rule; `.next`/pg caching levers in slice 1/4 |
| Flake returns on the bigger surface (TD-009 history) | Medium | Trust in the gate erodes, `main` blocked | Freeze criterion; retry + recording artifacts make flakes diagnosable rather than folklore |
| EPIC-003 slice 2 arrives before slice 5 | Medium | Capture sheet lands flow-less, retrofit tax | Explicit cross-epic dependency in §7/§11; revisit sequencing at EPIC-003 slice-1 close |
| Seed drift between web and mobile fixtures | Low | Flows assert stale values | Single shared fixture module where shapes allow (§10) |

## 16. ADR triggers

| Slice | Likely ADR(s) | Notes |
|-------|---------------|-------|
| 1 | Amendment to ADR 060 | Only if the pivot criterion fires (fixture server) or server-boot mode materially changes the ADR's shape |
| 2 | None expected | The seam design is settled in ADR 060; a deviation from the double-gate model would need an ADR-level rethink |
| 3 | None expected | Pure flow-authoring on settled infrastructure |
| 4 | None expected | Diagnostics are tooling, not direction |
| 5 | Possibly: mutating-flow isolation pattern | Only if the chosen strategy is novel enough that future write flows need it codified |

## 17. References

- [ADR 060 — Mobile E2E Phase 2](../decisions/060-mobile-e2e-real-backend-authenticated-journeys.md) (strategic ADR, drafted alongside)
- [ADR 055 — Mobile E2E via Local Dev-Client Build in CI](../decisions/055-mobile-e2e-via-eas-local-dev-client-in-ci.md) (the pipeline this extends)
- [ADR 051 — Mobile Authentication Model](../decisions/051-mobile-authentication-model.md) (the PKCE flow the auth seam taps)
- [ADR 057 — Autonomous Workflow](../decisions/057-autonomous-workflow-and-remote-execution.md) (why CI gates carry the review weight)
- [EPIC-003 — Mobile Spend Capture](./EPIC-003-mobile-spend-capture.md) (downstream consumer of the harness)
- [TD-009](../tech-debt.md) (mobile-e2e flake/cache history; constrains §9–§10)
- `apps/mobile/.maestro/flows/sign-in.yaml` (the current coverage ceiling, documented in its own comments)
- Issue [#144](https://github.com/matthew-a-carr/travel-planner/issues/144) (planning record)

---

## Slice ledger (append-only)

| Date | Slice # | SPEC | Status change | Notes |
|------|---------|------|---------------|-------|
| 2026-06-12 | — | — | Drafted | Drafted in an interactive session (issue #144); decisions taken on recommendation per §13. |
| 2026-06-12 | — | — | Approved | Approved by Matt in the PR #145 review loop; reciprocal EPIC-003 §7 amendment applied per §13 decision 4. |
| 2026-06-12 | 1 | SPEC-013 | Drafted / In progress | Spec + implementation in one session/PR at Matt's instruction (issue #146); resolves §13 deferred Q1–Q3. |
| 2026-06-12 | 1 | SPEC-013 | Complete | mobile-e2e green first attempt with real backend (run 27410045709); +~46s attributable runtime — pivot criterion nowhere near firing. Impl PR linked on open. |
| 2026-06-13 | 2 | SPEC-014 | Drafted / In progress | Spec + implementation in one session/PR (EPIC-002 / SPEC-013 precedent); resolves §13 deferred Q4. Double-gated `/test-token` seam + bundle-flag browser-leg injection + signed-in-journey flow. |
| 2026-06-13 | 2 | SPEC-014 | Complete | Full local suite green (lint, type-check, web unit 439, mobile unit 124, integration 330, build, openapi:check). Kill-criterion proof (404-when-unset) lands as a route int-test. `mobile-e2e` signed-in journey validated on the impl PR's CI run. |

## Epic-level deviations

_None yet._

## Post-epic notes

_Filled when the epic closes._
