# ADR 055: Mobile E2E via Local Dev-Client Build in CI (`expo prebuild` + `xcodebuild`)

**Date:** 2026-05-20
**Status:** Accepted
**Related:** [ADR 045 — iOS App Strategy](./045-ios-app-strategy.md), [ADR 052 — Mobile Application Foundation](./052-mobile-app-foundation-expo-metro-testing.md), [ADR 053 — Temporary Downgrade to Expo SDK 54](./053-expo-sdk-54-temporary-downgrade.md), [SPEC-006](../specs/SPEC-006-mobile-sign-in-pkce-keychain.md), [TD-002](../tech-debt.md)

## Context

ADR 052 settled the high-level CI shape for `apps/mobile/`:
`mobile-typecheck` and `mobile-unit-test` run on `ubuntu-latest`;
`mobile-e2e` runs on `macos-latest` because Maestro needs an iOS
Simulator. SPEC-003 then shipped the path-filtered workflow with the
Linux jobs wired up but **the `mobile-e2e` job left as a
placeholder** — it installed Maestro and exited, never running the
flows.

The reason for the placeholder: Maestro drives an *installed* app on
the simulator. We need a way to install `apps/mobile/` into the
simulator. The two obvious options both don't work:

- **Sideload Expo Go.** Apple's iOS Simulator only installs `.app`
  bundles produced from native iOS source; Expo Go is a distributed
  App Store app with no public dev bundle. Can't be installed via
  `xcrun simctl`.
- **Build a TestFlight-distributable `.ipa`.** Requires Apple
  Developer Program membership and code signing — EPIC-001 §6
  explicitly defers ADP to EPIC-002.

TD-002 captured this gap with the note "Land before slice 6 (login
flow needs its own Maestro flow that would also be skipped today)."

SPEC-006 (slice 6 of EPIC-001) introduces the first user journey
Maestro should actually exercise: the sign-in screen render and
the tap-to-open-browser transition. SPEC-006 needs to decide
between paying TD-002 down inside the slice (durable) or shipping
yet another flow that the placeholder skips (expedient). The
SPEC-006 grilling pass picked durable, after which a project-wide
"prefer durable over expedient" directive was codified in
`AGENTS.md`. This ADR records the *how* of paying TD-002 down.

The path forward exists because the Expo toolchain ships **`expo
prebuild`** to generate the native `ios/` directory from
`app.json` + plugins, and **`eas build --local --profile development
--platform ios`** to produce a dev-client `.app` bundle entirely on
the local machine (no EAS cloud minutes, no signing identity beyond
what Xcode's free developer profile auto-grants for simulator
builds).

The dev-client `.app` can then be installed into the simulator via
`xcrun simctl install`, booted, and driven by Maestro.

## Decision

`mobile-e2e` becomes a real job that:

1. Runs on `macos-latest` (path-filtered to `apps/mobile/**`,
   `pnpm-lock.yaml`, `pnpm-workspace.yaml`, per ADR 052).
2. Installs Xcode CLI tools (default on `macos-latest`), Node, and
   pnpm; runs `pnpm install --frozen-lockfile` at the repo root.
3. Runs `pnpm --filter @travel-planner/mobile exec expo prebuild --platform ios --clean`
   to regenerate the `ios/` directory from `app.json` and the
   `expo-router` plugin. The `ios/` directory is **not** committed
   to source control — it's an ephemeral build artefact.
4. Runs `pod install` in `apps/mobile/ios/` (CocoaPods is preinstalled
   on `macos-latest` runners).
5. Runs `xcodebuild -workspace TravelPlanner.xcworkspace -scheme
   TravelPlanner -configuration Release -sdk iphonesimulator
   -derivedDataPath build CODE_SIGNING_ALLOWED=NO` from
   `apps/mobile/ios/` to produce a self-contained `.app` for the iOS
   Simulator. **The original ADR draft named `eas build --local`
   here; switched to raw `xcodebuild` during step 9 implementation
   when EAS Local was found to require an EAS project ID + an EAS
   CLI session. The raw path has zero external-account dependency
   and matches the durable-bias directive in `AGENTS.md`.**
   **`Release` (not `Debug`):** Release runs the
   "Bundle React Native code and images" Xcode build phase, which
   invokes `react-native-xcode.sh` to bundle the JS and embed it in
   the `.app`. Debug builds skip this phase and rely on the Metro
   packager being reachable at launch; in CI Metro isn't running, so
   a Debug build boots into the "No script URL provided" red error
   screen and Maestro's `login-screen-root` assertion fails. The
   alternative — starting Metro in the background before Maestro —
   adds a packager lifecycle to the CI script and a flake surface
   that Release avoids by being self-contained.
6. Boots an iOS Simulator (first available `iPhone` device on the
   runner, via `xcrun simctl list devices available`).
7. Installs the bundle (`xcrun simctl install booted <.app>`).
8. Runs `pnpm test:e2e:mobile` (which expands to `maestro test .maestro/flows`).
9. On failure, uploads Maestro's report directory as a CI artifact
   (7-day retention).

The job is **blocking**. It originally shipped with
`continue-on-error: true` for a week-1 burn-in (per SPEC-006 §11) and
was promoted to blocking on 2026-05-22 alongside the Debug → Release
build fix — the week-1 buffer had been masking the missing-JS-bundle
regression on `main`, so the lever stopped being protective and
started being a hole.

The expected cost is **~4–6 minutes of macOS runner time per
affected PR** on cache hit, **~9–10 minutes on cache miss**, billing
at GitHub's $0.08/minute. Path filtering caps the rate.

**Build/test pipeline optimisations (2026-05-22):**

- `apps/mobile/ios/` (Pods + xcodebuild DerivedData),
  `~/Library/Caches/CocoaPods`, and `~/.maestro` are all restored
  from `actions/cache@v4`, keyed on
  `pnpm-lock.yaml + apps/mobile/package.json + apps/mobile/app.json`.
  These three files are the source of truth for the native build's
  contents; any drift invalidates the cache.
- `expo prebuild` runs **without** `--clean` so the cached `ios/`
  survives. The Expo CLI does an incremental update; the cache key
  itself is the stale-state guard.
- The iOS Simulator is booted **in the background** at the start of
  the job, so its ~60-second cold boot overlaps with prebuild, pod
  install, and xcodebuild instead of running sequentially.
- Only `sign-in.yaml` is kept in `.maestro/flows/` — the original
  `launch.yaml` was a strict subset (same testID assertions + button
  text), and Maestro paid the XCTest harness setup + app-launch cost
  twice for redundant coverage.

The combined effect is roughly halving the median runtime on warm
caches.

EAS Local is the **deliberate intermediate step** between the
placeholder (TD-002) and EAS Build / TestFlight (deferred to
EPIC-002). When EPIC-002 funds Apple Developer Program and switches
distribution to TestFlight, the dev-client `.app` is replaced by the
TestFlight build pipeline; the simulator-install-and-Maestro half of
this ADR likely survives unchanged.

## Consequences

**What becomes easier:**

- Maestro flows actually run in CI, on every `apps/mobile/**` PR.
  The substantive coverage of mobile UI regressions kicks in.
- TD-002 resolved without funding ADP. Stays inside EPIC-001 §6's
  no-ADP constraint.
- The pattern is reusable: future mobile slices (slice 7's "me"
  screen, slice 9's observability instrumentation) inherit a working
  Maestro pipeline.
- Test feedback loop for mobile-touching changes shifts from
  manual-on-device-or-skip to automated-in-CI, matching the web
  app's discipline.

**What becomes harder:**

- Every affected PR pays 4–6 min (cache hit) or 9–10 min
  (cache miss) of macOS runner time. Path filter limits the
  exposure to mobile-touching PRs. Validate the cost band after
  the first 10 affected PRs; if it overshoots, the next lever
  is moving to a self-hosted Mac runner.
- The pipeline has a new flake surface: macOS runner Xcode version
  drift, simulator-boot failures, EAS Local build environment
  inconsistencies. The Maestro report artifact is uploaded on
  failure to support post-mortem; the original `continue-on-error`
  buffer was retired on 2026-05-22 (see Decision).
- Cache poisoning is a new failure mode. If a corrupted DerivedData
  or Pods directory lands in the cache, subsequent runs will
  inherit it until the cache key changes. Mitigation: the key is
  scoped to `runner.os + lockfile hash`, so any lockfile or
  manifest churn rotates the entry; manual recovery is "bump any
  one of the three keyed files" or invalidate via the Actions UI.

**Trade-offs:**

- Could have deferred TD-002 further on the grounds that EPIC-002
  reshapes the pipeline anyway when EAS Build / TestFlight lands.
  Rejected per the durable-bias directive in `AGENTS.md` — the
  half-day cost is bounded and doesn't grow; the TODO that outlives
  team memory does. Also: slice 7 will introduce a second Maestro
  flow that would *also* be skipped under TD-002's placeholder,
  compounding the debt.
- Could have funded ADP early in EPIC-001 to use EAS Build /
  TestFlight directly (which doesn't need the EAS-Local-in-CI
  detour). Rejected per EPIC-001 §6 — ADP funding is the trigger
  for EPIC-002, not a slice-6 prerequisite.
- Could have written zero Maestro flows for slice 6 and relied
  entirely on jest+RNTL+msw component tests. Rejected per SPEC-006
  Q10 grilling — Maestro adds a launch-time + sign-in-button smoke
  test that jest+RNTL can't easily cover (no real bundler boot, no
  real navigation between screens, no real testID rendering).

**Trigger to revisit:**

- EPIC-002 funds Apple Developer Program and switches distribution
  to TestFlight via EAS Build. The dev-client local build step
  likely becomes the same EAS Build artefact that ships to
  TestFlight; the install-and-maestro half stays. Amend this ADR
  alongside that work.
- Cost-band validation after 10 affected PRs. If the macOS minutes
  meaningfully overshoot the $0.40–0.80 band, re-plan.
- macOS runner flakiness post-promotion. If more than ~1 flake per
  5 runs reaches `main`, reintroduce `continue-on-error: true` as a
  short-term buffer while the flake source is fixed, or drop back to
  local-only Maestro + reopen TD-002 with the failure mode
  documented.
