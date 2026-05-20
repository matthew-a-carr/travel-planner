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
   TravelPlanner -configuration Debug -sdk iphonesimulator
   -derivedDataPath build CODE_SIGNING_ALLOWED=NO` from
   `apps/mobile/ios/` to produce a dev-client `.app` for the iOS
   Simulator. **The original ADR draft named `eas build --local`
   here; switched to raw `xcodebuild` during step 9 implementation
   when EAS Local was found to require an EAS project ID + an EAS
   CLI session. The raw path has zero external-account dependency
   and matches the durable-bias directive in `AGENTS.md`.**
6. Boots an iOS Simulator (first available `iPhone` device on the
   runner, via `xcrun simctl list devices available`).
7. Installs the bundle (`xcrun simctl install booted <.app>`).
8. Runs `pnpm test:e2e:mobile` (which expands to `maestro test .maestro/flows`).
9. On failure, uploads Maestro's report directory as a CI artifact
   (7-day retention).

The job is marked **`continue-on-error: true` for the first week** of
operation (per SPEC-006 §11) and promoted to blocking once it has a
stable track record. A calendar reminder gates the promotion.

The expected cost is **~5–10 minutes of macOS runner time per
affected PR**, billing at GitHub's $0.08/minute (~$0.40–0.80 per
run). Path filtering caps the rate.

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

- Every affected PR now pays 5–10 minutes of macOS runner time
  (~$0.40–0.80). Path filter limits the exposure to
  mobile-touching PRs. Validate the cost band after the first 10
  affected PRs; if it overshoots, re-plan (e.g. cache `ios/`
  prebuild output across runs, or move to a self-hosted Mac runner).
- The pipeline has a new flake surface: macOS runner Xcode version
  drift, simulator-boot failures, EAS Local build environment
  inconsistencies. Mitigated by `continue-on-error: true` for week 1
  and the artifact upload on failure.
- `expo prebuild --clean` regenerates `ios/` from scratch each run.
  Caching the `~/Library/Caches/expo-prebuild` directory between
  runs may halve build time but is optional first-pass; tune after
  the cost-band validation period.

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
- macOS runner flakiness in week 1. If `continue-on-error: true`
  surfaces more than ~1 flake per 5 runs, drop back to local-only
  Maestro + reopen TD-002 with the failure mode documented.
