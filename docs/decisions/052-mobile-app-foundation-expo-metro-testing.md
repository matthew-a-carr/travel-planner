# ADR 052: Mobile Application Foundation — Expo, Metro, and Testing Strategy

**Date:** 2026-05-20
**Status:** Accepted (§1 SDK pin, §3 Metro config, and §5 test layout amended by [ADR 053](053-expo-sdk-54-temporary-downgrade.md))

## Context

EPIC-001 (iOS App) targets an Expo + React Native app shipped via
Expo Go for the audience-of-two phase. SPEC-001 / 002 / SPEC-003
collectively form the foundation. This ADR codifies the
mobile-side foundation decisions in one place rather than fragmenting
them across two ADRs as EPIC §16 originally split them.

Three interlocking decision domains need to land coherently before
slice 6 (sign-in UI) starts:

1. **Framework + SDK version.** Confirmed Expo over bare React
   Native, Capacitor, and SwiftUI in ADR 045. Slice 3 of SPEC-003's
   grilling re-examined this question explicitly; Expo remains the
   right answer for the audience-of-two iOS-Go context.
2. **Pnpm-monorepo Metro configuration.** A real gotcha: Metro's
   default module resolution doesn't speak pnpm's isolated symlink
   layout. Without the right config, Metro silently picks up the
   wrong tree or fails with cryptic "cannot resolve" errors. Two
   viable strategies (Metro symlink support vs `node-linker=hoisted`)
   needed evaluating.
3. **Mobile testing strategy.** EPIC-001 §10 settled the broad
   strokes (Jest, RNTL, msw/native, Maestro). SPEC-003 merged the
   originally-separate slice 8 into slice 5 to land the harness
   alongside the scaffold, matching the web app's TDD-from-day-one
   discipline. The runner choice (Jest vs Vitest) was re-examined
   during SPEC-003's grilling; Jest reaffirmed.

## Decision

Adopt the following mobile-foundation stack for `apps/mobile/`.

### 1. Expo SDK 55 + Expo Router 55

> **Amended 2026-05-20 by [ADR 053](053-expo-sdk-54-temporary-downgrade.md):**
> the SDK pin is temporarily SDK 54 while App Store Expo Go's SDK 55
> build is stuck in Apple's approval queue. Distribution mechanics,
> tooling rationale, and "no Apple Developer Program until EPIC-002"
> position all stand — only the specific SDK version differs. Re-upgrade
> tracked as TD-003.

- Pinned in `apps/mobile/package.json`.
- TypeScript template, strict mode (matching the web app).
- SDK upgrade trigger: when Expo SDK N+1 ships and reaches stable
  for at least 4 weeks; chore PR. Not on an SDK-release-day urgency.
- Distribution: Expo Go for the entire EPIC-001 phase. EAS Build
  and Apple Developer Program ($99/yr) are deferred to EPIC-002's
  first slice per ADR 045 / EPIC-001 §11.

### 2. Manual scaffold (not `create-expo-app`)

Hand-write the seven minimal files (`package.json`, `tsconfig.json`,
`babel.config.js`, `metro.config.js`, `app.json`, `app/_layout.tsx`,
`app/index.tsx`). Reasons:

- `create-expo-app` produces ~30 files we'd strip back to 7;
  delete-churn obscures intent in the first commit.
- `create-expo-app` is unaware of pnpm monorepos and emits
  dependency wiring Metro can't resolve.
- Manual scaffold lets pnpm-specific Metro config land inline rather
  than surgically patched into a generated file.

### 3. Metro `unstable_enableSymlinks` + `watchFolders` (not hoisted linker)

> **Amended 2026-05-20 by [ADR 053](053-expo-sdk-54-temporary-downgrade.md):**
> Expo SDK 54's `expo/metro-config` `getDefaultConfig()` now detects
> the pnpm workspace and configures `watchFolders`,
> `resolver.nodeModulesPaths`, and symlink resolution automatically.
> The manual overrides documented below (especially
> `disableHierarchicalLookup: true`) break SDK 54's transitive-dep
> resolution for packages that ship `src/*.ts` entry points whose
> adjacent `node_modules` is only reachable via hierarchical lookup.
> `apps/mobile/metro.config.js` is now the minimal default. The
> "hoisted linker fallback" escape hatch below still stands if Metro
> regresses on pnpm in a future SDK.

`apps/mobile/metro.config.js` enables Metro's experimental symlink
resolver and points `watchFolders` at the workspace root so Metro
can find hoisted dependencies and the workspace siblings:

```js
const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');
config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];
config.resolver.unstable_enableSymlinks = true;
config.resolver.disableHierarchicalLookup = true;
```

The alternative — `node-linker=hoisted` globally — would lose pnpm's
strict isolation guarantees for the entire workspace, including the
web app where architecture tests rely on them. Metro symlink config
keeps strictness everywhere.

**Fallback:** if Metro's `unstable_enableSymlinks` breaks on a future
Expo SDK, switch to `node-linker=hoisted` on `apps/mobile/` only.
Recorded as a documented escape hatch.

### 4. App identifier `dev.matthewcarr.travelplanner`

Reverse-DNS, no redundant trailing `.dev`. Identifier does not need
to match a registered domain (Expo Go runs any bundle ID). When
App Store entry becomes relevant (EPIC-002 or later), a fresh
production ID may be registered.

### 5. Mobile test stack

- **Runner: Jest 30 with `jest-expo` preset.** Reaffirmed over
  Vitest after a speed-math reality-check (SPEC-003 grilling).
  Vitest's Vite-transform advantage erodes under the RN module
  resolution translation layer that any Vitest+RN community plugin
  must add. Jest is the canonical RN runner; the entire RN
  ecosystem (Expo docs, `@testing-library/react-native`, msw/native
  examples) assumes it.
- **Component tests: `@testing-library/react-native`.** Same mental
  model as RTL on web; co-located `*.test.tsx` files next to source.

  > **Amended 2026-05-20 by [ADR 053](053-expo-sdk-54-temporary-downgrade.md):**
  > Co-location inside `app/` is not viable with Expo Router — every
  > file in `app/` is treated as a route, so `*.test.tsx` files would
  > be bundled into the iOS app. Tests now live under
  > `apps/mobile/__tests__/` mirroring the `app/` source tree.
- **API mocking: `msw/native`.** Server-lifecycle hooks live in
  `jest.setup.ts`; mock handlers under `apps/mobile/__mocks__/`
  when slice 6 introduces them.
- **E2E: Maestro** YAML flows under `apps/mobile/.maestro/flows/`.
  Each user journey gets its own YAML.

### 6. Path-filtered CI

Three new GitHub Actions jobs in `.github/workflows/ci.yml`, all
path-filtered via a shared `detect-changes` job that watches
`apps/mobile/**`, `pnpm-lock.yaml`, and `pnpm-workspace.yaml`:

| Job | Runner | Why |
|-----|--------|-----|
| `mobile-typecheck` | `ubuntu-latest` | `tsc --noEmit` on the mobile package |
| `mobile-unit-test` | `ubuntu-latest` | Jest + RNTL |
| `mobile-e2e` | `macos-latest` | Maestro needs iOS Simulator |

**Lint is not split per app.** The top-level `lint` job runs Biome
from the repo root, and `biome.json`'s `includes` pattern covers
both `apps/web/src/**` and `apps/mobile/app/**` +
`apps/mobile/*.{ts,tsx,js,mjs}`. One lint check, one source of
truth, no duplication.

The macOS runner is ~10× the cost of Linux on GitHub Actions
billing. Path filter is load-bearing — web-only PRs (e.g. Dependabot
bumps of web deps, docs changes) must skip the macOS job.

### 7. testID convention

Every interactive element AND every screen-root view MUST carry a
stable `testID`. Naming pattern: `<screen>-<element>` (e.g.
`login-google-button`, `hello-screen-greeting`). Maestro flows
reference these rather than visible text where text might be
localised or changed cosmetically.

This convention is codified in `apps/mobile/AGENTS.md` and is
enforced by code review (no automated enforcement today; future
ADR may add a custom lint rule if discipline slips).

### 8. Out of slice 5

- Sentry RN — slice 9.
- App icons, splash screens, custom fonts — arrive with slice 6's
  UI.
- Storybook for React Native — out of v1; revisit if component
  complexity warrants.
- Architecture tests (layered-import enforcement) — the mobile app
  is one screen this slice; the discipline lands when there are
  layers worth enforcing.

## Consequences

**What becomes easier:**

- A fresh contributor (or AI agent) clones the repo, runs
  `pnpm install` + `pnpm dev:mobile`, and is shipping changes to
  an Expo Go app within minutes.
- Every mobile slice from 6 onward inherits a TDD harness that
  matches the web app's discipline. No retro-fitting tests after
  the milestone.
- Path-filtered CI keeps web PRs fast (no macOS runner spin-up for
  web-only work) while preserving full mobile coverage when it
  matters.
- testID discipline from day one means Maestro flows in slice 6+
  can target elements without text-coupling.
- The `metro.config.js` keeps pnpm's strict isolation intact for
  the web app, preserving the architecture-test guarantees.

**What becomes harder:**

- Two test runners (Vitest for web, Jest for mobile) is operational
  overhead. The syntax surface area is ~95% shared, so the cost is
  small but non-zero (one extra config file, one extra deps
  family).
- macOS runner cost on `mobile-e2e` is meaningful. Mitigated by
  path-filtering. If the filter ever silently breaks, CI minutes
  drain rapidly.
- `unstable_enableSymlinks` carries the `unstable_` prefix.
  Reliable in practice for SDK 51+ but may need a future swap to
  hoisted-linker fallback.
- Future Expo SDK upgrades will touch `package.json` peer deps and
  may force Jest / RNTL upgrades simultaneously. Chore-sized PRs.

**Trade-offs:**

- **Expo vs bare RN vs SwiftUI**: chose Expo for the
  audience-of-two iOS Go context. Future Swift migration remains
  reachable because the v1 API is transport-agnostic (ADR 045 / 050
  / 051). Re-examined in SPEC-003's grilling; reaffirmed.
- **Jest vs Vitest for mobile**: chose Jest for ecosystem
  alignment. Re-examined in SPEC-003's grilling; reaffirmed after
  honest speed-math.
- **Manual scaffold vs `create-expo-app`**: chose manual for
  reviewability and pnpm-config inlining. Trade-off: must keep an
  eye on Expo's own defaults when SDK upgrades land.
- **Metro symlinks vs hoisted linker**: chose Metro symlinks to
  preserve pnpm strictness. Trade-off: relies on the
  `unstable_enableSymlinks` API.
- **Path-filtered mobile CI**: chose to filter only mobile (not
  web). Web is the primary surface and must run on every PR; mobile
  is opt-in by file scope. Trade-off: a Dependabot PR touching a
  shared deep dependency might warrant mobile testing but won't
  trigger it. Acceptable for v1; revisit if it bites.
