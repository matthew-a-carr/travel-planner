# ADR 053: Temporary Downgrade to Expo SDK 54 Pending App Store Approval of SDK 55 Expo Go

**Date:** 2026-05-20
**Status:** Accepted
**Amends:**
- [ADR 052 §1 — Expo SDK 55 + Expo Router 55](052-mobile-app-foundation-expo-metro-testing.md)
- [ADR 052 §3 — Metro `unstable_enableSymlinks` + `watchFolders`](052-mobile-app-foundation-expo-metro-testing.md)
- [ADR 052 §5 — Test layout: co-located `*.test.tsx` inside `app/`](052-mobile-app-foundation-expo-metro-testing.md)

## Context

EPIC-001 distributes the mobile client via Expo Go for the entire
audience-of-two phase (no Apple Developer Program funded yet; deferred
to EPIC-002). ADR 052 §1 pinned `apps/mobile/` to Expo SDK 55 + Expo
Router 55 on the assumption that App Store Expo Go would track each
new SDK release within the usual window.

On 2026-05-04 Expo published
[*Expo Go and the App Store in May 2026*](https://expo.dev/changelog/expo-go-and-app-store-may-2026)
confirming that **Expo Go for SDK 55 is stuck in Apple's approval
process with no clear timeline**. The version currently downloadable
from the App Store remains the SDK 54 build. Scanning the SDK 55 dev
manifest from `expo start` against the latest App Store Expo Go
returns "you need the latest version of Expo Go" — the iPhone is on
the latest available version; the manifest is simply newer than what
the App Store build supports.

That blocks the EPIC-001 demo loop directly: there is no on-device
path to run the SDK 55 bundle without funding the Apple Developer
Program ($99/yr) and using `eas go` via TestFlight, which is exactly
the scope EPIC-001 §6 / ADR 045 deferred to EPIC-002.

EPIC-001 §9 lists this kind of distribution stall as a pivot trigger
("If Expo Go fails to pair, install, or reliably re-launch on the
partner's iPhone during baseline testing before slice 7 closes…").
The author's own iPhone hits the same blocker today, so the trigger
fires on the primary device rather than the partner's. The (a) pivot
(fund ADP early) and (d) Simulator-only options were considered and
rejected as either premature spend or losing the on-device demo line
in §4 unnecessarily.

## Decision

Downgrade `apps/mobile/` to Expo SDK 54 until App Store Expo Go ships
SDK 55 support. Bumps pinned in `apps/mobile/package.json`, resolved
via `expo install --fix` against Expo's bundled-native-modules manifest
for SDK 54.0.34:

| Package | SDK 55 (was) | SDK 54 (now) |
|---------|--------------|--------------|
| `expo` | `^55.0.25` | `^54.0.34` |
| `expo-router` | `^55.0.15` | `~6.0.23` |
| `expo-status-bar` | `~55.0.6` | `~3.0.9` |
| `react` | `19.2.0` | `19.1.0` |
| `react-native` | `0.83.6` | `0.81.5` |
| `react-native-safe-area-context` | `5.6.2` | `~5.6.0` |
| `react-native-screens` | `~4.23.0` | `~4.16.0` |
| `jest-expo` | `^55.0.18` | `^54.0.17` |
| `react-test-renderer` | `19.2.0` | `19.1.0` |
| `@types/react` | `~19.2.14` | `~19.1.17` |

### Metro config: strip back to `getDefaultConfig`

ADR 052 §3 documented a hand-rolled `metro.config.js` that set
`watchFolders`, `resolver.nodeModulesPaths`,
`unstable_enableSymlinks: true`, **and**
`disableHierarchicalLookup: true`. That configuration was correct for
SDK 51-era Expo, when Metro didn't auto-detect pnpm workspaces.

Under SDK 54, `disableHierarchicalLookup: true` breaks transitive-dep
resolution. `@expo/metro-runtime@6.1.2` ships its source files
(`main: "src/index.ts"`) rather than a pre-built bundle, and its
`src/location/install.native.ts` imports `whatwg-fetch` as a direct
runtime dep. With hierarchical lookup disabled, Metro cannot find
`whatwg-fetch` in the metro-runtime package's own `.pnpm/.../node_modules/`
isolate — the bundle fails with `Unable to resolve "whatwg-fetch"`.

Per Expo's [official monorepo guide](https://docs.expo.dev/guides/monorepos/),
`expo/metro-config@54`'s `getDefaultConfig()` now detects pnpm,
yarn, npm, and bun workspaces and configures everything ADR 052 §3
configured manually — without breaking transitive-dep resolution.

`apps/mobile/metro.config.js` is therefore reduced to:

```js
const { getDefaultConfig } = require('expo/metro-config');
module.exports = getDefaultConfig(__dirname);
```

The "hoisted linker fallback" escape hatch from ADR 052 §3 still
stands if Metro regresses on pnpm in a future SDK.

### Test layout: `__tests__/` mirrors `app/`, not co-located

ADR 052 §5 stated "Component tests: co-located `*.test.tsx` files next
to source." That convention can't hold under Expo Router — every file
under `app/` is treated as a route, so `app/index.test.tsx` gets
bundled into the iOS app. The bundle then transitively pulls in
`@testing-library/react-native`'s `helpers/logger.js`, which `require`s
Node's `console` and `util` and crashes the native runtime.

Tests for mobile now live under `apps/mobile/__tests__/` mirroring the
`app/` source layout. So `apps/mobile/app/index.tsx`'s test is
`apps/mobile/__tests__/app/index.test.tsx`. This matches Expo's
[official guidance](https://docs.expo.dev/router/reference/testing/)
that the `app/` directory contains only routes and layouts.

`jest.config.js`'s `testMatch` updated to
`<rootDir>/__tests__/**/*.test.{ts,tsx}` accordingly.

Maestro flows (`.maestro/flows/*.yaml`) are unaffected — they were
already outside `app/`.

### Unchanged from ADR 052

Manual scaffold (§2), Jest 29 (still — `jest-expo@54` continues to
ship a Jest 29 internals dependency), `@testing-library/react-native`
as the library (§5), msw/native (§5), Maestro (§5), path-filtered
CI (§6), testID convention (§7), `dev.matthewcarr.travelplanner`
bundle identifier (§4). Only the *location* of test files changed.

### Re-upgrade trigger

Tracked as **TD-003** in `docs/tech-debt.md`. Re-upgrade to Expo SDK 55
when either:

1. Expo Go on the App Store reports SDK 55 in its About screen, **or**
2. EPIC-002 funds the Apple Developer Program and switches distribution
   from App Store Expo Go to `eas go` (TestFlight) — at which point
   the App Store SDK 55 approval ceases to be load-bearing.

Until then, do **not** speculatively bump to SDK 55 patches even if
they ship to npm. The constraint is App Store Expo Go's compat
window, not npm.

## Consequences

**What becomes easier:**

- The author's iPhone runs the app today via App Store Expo Go. The
  EPIC-001 demo script (§4) works as written.
- The §9 kill criteria don't fire on a non-distribution issue, so the
  epic stays on its critical path: slice 3 (mobile OAuth endpoints)
  remains the next slice with no scope or sequencing change.
- ADP funding stays deferred to EPIC-002 as originally planned. No
  surprise spend.

**What becomes harder:**

- Two SDK versions get tracked in parallel: ADR 052 narrates SDK 55,
  this ADR overrides it with SDK 54. Future contributors must read
  both. Mitigation: ADR 052 §1 has an "Amended by ADR 053" pointer;
  ADR index marks 052 accordingly.
- React 19.1 and React Native 0.81 features are now the floor for
  mobile code (notably `use` hook semantics and any 19.2-only APIs).
  None of EPIC-001's planned slices were going to lean on those —
  flagged here as a known boundary.
- The SafeAreaView deprecation warning surfaces in Jest output on RN
  0.81 (same warning on 0.83). Pre-existing; not part of this ADR's
  scope to fix. If it becomes noisy, swap the import to
  `react-native-safe-area-context` (already a dependency) in a small
  chore PR.
- Re-upgrade to SDK 55 will require a second alignment pass once it
  unblocks: `expo install --fix`, peer-dep sweep, re-pin
  `react@19.2`, re-run mobile tests + type-check. Estimated half day.

**Trade-offs:**

- **Downgrade vs fund ADP now**: chose downgrade. ADP is $99/yr and
  pulls EPIC-002 work forward; SDK 54 keeps the same demo loop running
  for free until Apple unsticks itself. If Apple's stall stretches past
  several months and SDK 54 starts genuinely lagging needed features,
  this trade flips and EPIC-002's first slice gets pulled forward.
- **Downgrade vs Simulator-only dev**: chose downgrade. Simulator-only
  loses the on-device demo line that EPIC-001 §4 was built around and
  doesn't materially reduce work — the on-device validation needs to
  happen anyway before slice 7 closes.
- **Downgrade vs wait for Apple**: chose downgrade. Expo's announcement
  was explicit that there's no clear timeline; blocking the epic on an
  external party's review queue is the option with the worst expected
  value.

### Re-upgrade implications for the Metro config

When SDK 55 returns to the App Store and TD-003 is paid, the Metro
config decision should be revisited. SDK 55+ likely keeps the
`getDefaultConfig`-handles-pnpm behaviour intact, so the minimal
config in this ADR should continue to work. If a future SDK
regresses, fall back to the ADR 052 §3 stanza (without
`disableHierarchicalLookup`) or to the documented hoisted-linker
escape hatch.

## References

- [Expo changelog — Expo Go and the App Store in May 2026](https://expo.dev/changelog/expo-go-and-app-store-may-2026)
- [Expo SDK 54 release notes](https://expo.dev/changelog/sdk-54)
- [Expo — Working with monorepos](https://docs.expo.dev/guides/monorepos/)
- [ADR 045 — iOS App Strategy](045-ios-app-strategy.md)
- [ADR 052 — Mobile Application Foundation](052-mobile-app-foundation-expo-metro-testing.md)
- [EPIC-001 §9 — Kill / pivot criteria](../epics/EPIC-001-ios-app.md)
- [tech-debt.md TD-003](../tech-debt.md)
