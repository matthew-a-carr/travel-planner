# SPEC-003: Mobile App Foundation — Expo Skeleton + Testing Infra

**Date:** 2026-05-20
**Status:** Approved
**Author:** Matt Carr (with Claude Opus 4.7 via `plan-feature` + `grill-me`)
**Approved by:** Matt Carr, 2026-05-20
**Parent epic:** [EPIC-001 — iOS App](../epics/EPIC-001-ios-app.md) — **merged slice 5 + slice 8**

> **Epic-level deviation.** EPIC-001 §7 originally split this as slice 5
> (Expo skeleton, 2d) and slice 8 (mobile testing infra, 3d). This SPEC
> merges them so the testing harness is in place before slice 6 starts —
> matching the web app's TDD-from-day-one discipline. Logged in EPIC-001
> §16 (Epic-level deviations).

---

## 1. Summary

Scaffold the iOS app under `apps/mobile/` with Expo SDK 55 + Expo
Router. Configure Metro for the pnpm monorepo via
`unstable_enableSymlinks` + `watchFolders`. Ship a single styled "Hello,
Travel Planner" screen that runs in Expo Go via QR-code on the author's
iPhone. Bring up the full mobile testing infrastructure in the same
slice: Jest + `@testing-library/react-native` + `msw/native` for
component tests, Maestro YAML flows for E2E, path-filtered CI jobs (web-
only PRs skip the expensive macOS runner). Land `apps/mobile/AGENTS.md`
documenting conventions. The slice's ADR codifies the SDK, Metro, and
testing decisions in one place.

## 2. Motivation

EPIC-001's milestone (slice 7) is "Hello, Matt on home screen" — a
mobile app authenticated against the v1 API. Slices 1–2 shipped the
API surface. Slice 3 (PKCE issuance) is paused so we can de-risk the
mobile pipeline first: validate Expo Go on the author's iPhone (and
shortly after, the partner's iPhone — EPIC-001 §9 kill criterion).
Testing infra ships now (not deferred to slice 8) so every subsequent
mobile slice inherits the same TDD discipline the web app has, where
domain unit tests / integration tests / e2e are written before
implementation.

Inherited from EPIC-001 §10 (no re-litigation):

- Mobile framework: **Expo + React Native + Expo Router**.
- Distribution: **Expo Go for dev**; EAS Build deferred to EPIC-002.
- Mobile test runner: **Jest** in `apps/mobile/` (Vitest stays in
  `apps/web/`). Reaffirmed in this slice's grilling after a Vitest
  reality-check.
- Mobile E2E: **Maestro** YAML on iOS Simulator, path-filtered macOS CI job.
- Mobile observability: Sentry RN — slice 9, **not** this slice.

## 3. Acceptance criteria

1. A fresh `pnpm install` from repo root completes without
   `[ERR_PNPM_IGNORED_BUILDS]` and resolves all `apps/mobile/`
   dependencies.
2. `pnpm dev:mobile` prints a Metro QR-code in the terminal.
3. Scanning the QR with Expo Go on the author's iPhone shows a
   centered styled card containing the literal text **"Hello, Travel
   Planner"** with safe-area insets respected.
4. `pnpm mobile:test` executes the Jest suite (≥1 render test on the
   Hello screen) and exits 0.
5. `pnpm mobile:e2e` executes Maestro's `launch.yaml` flow against the
   iOS Simulator, asserts the Hello text is visible, and exits 0.
6. A push to a branch touching only `apps/web/**` triggers the
   existing web CI jobs only — `mobile-lint`, `mobile-typecheck`,
   `mobile-unit-test`, `mobile-e2e` are all skipped.
7. A push touching `apps/mobile/**` triggers all four mobile CI jobs,
   with `mobile-e2e` running on `macos-latest`.
8. `apps/mobile/AGENTS.md` exists alongside an `apps/mobile/CLAUDE.md`
   symlink, documenting where new screens / tests / Maestro flows live
   and the testID convention.
9. The slice 5 ADR exists in `docs/decisions/` with the next free
   number, status `Accepted`, listed in `docs/decisions/README.md`,
   and documents: SDK 55 pin, Metro `unstable_enableSymlinks`
   strategy, manual-scaffold call, Jest+RNTL+msw/native test stack,
   Maestro choice, path-filtered CI shape, testID convention,
   reaffirmed framework + runner reality-checks.
10. EPIC-001 §16 has a new "Epic-level deviations" row recording the
    slice 5 + slice 8 merge.

## 4. Demo script

1. `git pull` on a fresh clone, then `pnpm install`. Both succeed.
2. In one terminal: `pnpm dev:mobile`. Metro starts, prints QR-code.
3. On iPhone: open Expo Go, tap "Scan QR code", point at terminal.
4. App boots, shows "Hello, Travel Planner" in a centered card.
5. In another terminal: `pnpm mobile:test`. Jest output:
   `Test Suites: 1 passed, 1 total; Tests: 1 passed, 1 total`.
6. In a third terminal (macOS): `pnpm mobile:e2e`. Maestro spins up
   iOS Simulator, launches the app, asserts visible text, exits 0.
7. Hand iPhone to a reviewer. They open Expo Go (same project URL),
   see the same Hello screen on their device. Slice is demoed.

## 5. Out of scope

- **Any API call.** Slice 6 ships the first mobile→API request.
- **Authentication.** Slice 6 brings sign-in + Keychain.
- **Navigation between screens.** Single-screen app for now.
- **`packages/shared/` consumption.** Slice 4 introduces the package;
  slice 6 first uses it.
- **Sentry RN** — slice 9.
- **EAS Build / TestFlight / Apple Dev Program** — EPIC-002.
- **App icons, splash screens, custom fonts** — cosmetic; arrive with
  slice 6's first real UI.
- **Storybook for React Native** — out of v1.
- **Architecture tests (layered-import enforcement)** — the mobile app
  is one screen; the discipline lands when there are layers worth
  enforcing.
- **Path-filtered CI for `apps/web/**`** — web stays the primary
  surface; mobile's filter exists only to manage the macOS-runner cost.

## 6. Prerequisites

- EPIC-001 status is **Approved** ✅.
- SPEC-001 and SPEC-002 are **Complete** ✅ (foundation API exists).
- `pnpm-workspace.yaml` already lists `apps/*` (ADR 046).
- Docker available locally for Testcontainers (existing convention).
- macOS GitHub Actions runner billing acceptable for occasional
  `mobile-e2e` job runs.

### Prerequisite for slice 6 (set here, ticked there)

- [ ] **Partner-device validation.** Before slice 6 begins, the
  partner must successfully install Expo Go on her iPhone, scan the
  project URL, and see the Hello screen. If this fails, EPIC-001 §9's
  partner-device kill criterion fires and slice 6 is replanned (PWA
  pivot or fast-track EAS Build via funded ADP).

## 7. Design

### Workspace structure

```
apps/mobile/
├── app/                          ← Expo Router screens
│   ├── _layout.tsx              ← root layout
│   ├── index.tsx                ← the Hello screen
│   └── index.test.tsx           ← Jest render test (co-located)
├── .maestro/
│   └── flows/
│       └── launch.yaml          ← E2E flow
├── AGENTS.md                     ← layer rules + dev loop (+ CLAUDE.md symlink)
├── app.json                      ← Expo config (identifier, name, sdk version)
├── babel.config.js               ← required by Metro
├── jest.config.js                ← jest-expo preset + setup files
├── jest.setup.ts                 ← @testing-library/react-native matchers
├── metro.config.js               ← unstable_enableSymlinks + watchFolders
├── package.json                  ← @travel-planner/mobile workspace package
├── tsconfig.json                 ← extends ../../tsconfig.base.json (TBD if exists, else inline)
└── README.md                     ← dev loop quickstart
```

### Metro configuration (the critical piece)

```js
// metro.config.js
const { getDefaultConfig } = require('expo/metro-config');
const path = require('node:path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// pnpm support: watch the entire workspace and resolve symlinked deps.
config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];
config.resolver.unstable_enableSymlinks = true;
config.resolver.disableHierarchicalLookup = true;

module.exports = config;
```

### The Hello screen

```tsx
// app/index.tsx
import { SafeAreaView, View, Text } from 'react-native';

export default function HelloScreen() {
  return (
    <SafeAreaView
      style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}
      testID="hello-screen-root"
    >
      <View
        style={{
          padding: 24,
          borderRadius: 12,
          backgroundColor: '#f4f4f5',
        }}
      >
        <Text
          style={{ fontSize: 24, fontWeight: '600' }}
          testID="hello-screen-greeting"
        >
          Hello, Travel Planner
        </Text>
      </View>
    </SafeAreaView>
  );
}
```

A `testID` lands from day one — even on the root view — so Maestro
flows can target it directly. Convention is documented in
`apps/mobile/AGENTS.md`.

### Jest configuration

```js
// jest.config.js
module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEach: ['<rootDir>/jest.setup.ts'],
  testMatch: ['<rootDir>/app/**/*.test.{ts,tsx}'],
  // msw/native server lifecycle hooks live in jest.setup.ts.
};
```

```ts
// jest.setup.ts
import '@testing-library/react-native/extend-expect';
// msw server lifecycle will be added here once a test needs it (slice 6).
```

### Maestro flow

```yaml
# .maestro/flows/launch.yaml
appId: dev.matthewcarr.travelplanner
---
- launchApp
- assertVisible: "Hello, Travel Planner"
```

### CI job structure

```yaml
# .github/workflows/ci.yml — new jobs (additive)
mobile-lint:
  runs-on: ubuntu-latest
  paths: ['apps/mobile/**']
  steps: [...]

mobile-typecheck:
  runs-on: ubuntu-latest
  paths: ['apps/mobile/**']
  steps: [...]

mobile-unit-test:
  runs-on: ubuntu-latest
  paths: ['apps/mobile/**']
  steps: [...]

mobile-e2e:
  runs-on: macos-latest
  paths: ['apps/mobile/**']
  steps: [...]
```

### apps/mobile/AGENTS.md (key contents)

- File-system layout map (`app/`, `.maestro/`, etc.).
- TestID convention: every interactive element MUST have a stable
  `testID`. Naming pattern: `<screen>-<element>` (e.g. `login-google-button`).
- Test-file naming: `*.test.tsx` co-located with source.
- Maestro flows: one YAML per user journey under `.maestro/flows/`.
- Dev loop:
  - `pnpm dev:mobile` from repo root
  - QR-scan via Expo Go on physical iPhone
  - Per-slice acceptance includes a Maestro flow + a Jest render test
- Doc-review table: what to update if X changes.

### Storage & migrations

N/A — no schema change; mobile is read-only against the API (and even
that's slice 6).

### External integrations

- **Expo SDK 55** — pinned in `apps/mobile/package.json`.
- **Expo Go** — distribution path, no integration code.
- **jest-expo, @testing-library/react-native, msw, msw/native** —
  new direct deps on `apps/mobile/`.

### UI / UX

Single styled card, centered, system colours. Mobile-first by
definition. Accessibility is satisfied trivially at this slice (one
text element, has accessibility label via its content); fuller
accessibility audit lands when interactive UI does.

## 8. Security & data considerations

- **Threats considered:**
  - **Expo Go bundle interception.** The QR-code carries a URL to a
    Metro-served bundle on the dev machine. On a hostile network the
    bundle could be intercepted/modified. Mitigated by Expo's own
    tunnelling and by the fact that Expo Go bundles run in a sandbox
    with limited native access.
  - **Test fixtures leaking secrets.** No real credentials in tests
    yet. When msw mock data lands in slice 6, it stays under
    `apps/mobile/__mocks__/` and uses obviously-fake values.
- **Secrets needed:** None for this slice. `AUTH_JWT_SIGNING_KEY`
  remains a web-side concern.

## 9. Test plan

### E2E (Maestro)

| Flow | Asserts |
|------|---------|
| `apps/mobile/.maestro/flows/launch.yaml` | App launches; "Hello, Travel Planner" visible. |

Runs via `pnpm mobile:e2e` locally (requires iOS Simulator) and on
`macos-latest` in CI for any `apps/mobile/**` change.

### Component (Jest + RNTL)

| Test file | What it covers |
|-----------|---------------|
| `apps/mobile/app/index.test.tsx` | Renders `<HelloScreen />`; queries for `testID="hello-screen-greeting"`; asserts text matches. Proves the Jest + RNTL pipeline works end-to-end. |

### API mocking (msw/native)

N/A this slice — no API calls. Server-lifecycle setup lives in
`jest.setup.ts` ready for slice 6.

### Manual checks

- Demo script §4: live Expo Go run on the author's iPhone.
- Partner-device check: tracked as §6 prerequisite for slice 6.

## 10. Observability

- **Logs:** Expo Metro logs to the terminal during `pnpm dev:mobile`.
  No additional in-app logging.
- **Metrics:** None new. Sentry RN arrives in slice 9.
- **Sentry / error reporting:** Deliberately deferred (slice 9). Until
  then, runtime errors surface via Expo's redbox in dev.

## 11. Rollback / safety

Slice 5 is purely additive. Rollback = revert merge. No production
behaviour changes; the web app and the API stay unchanged. No env-var
changes. No CI changes affect existing jobs (all new jobs are additive
and path-filtered).

## 12. Implementation order

1. [ ] **Intent:** Draft ADR "Mobile Application Foundation: Expo,
   Metro, and Testing Strategy" with next free ADR number.
   **Verification:** Self-review against §3 acceptance #9. **Commit:**
   `docs(mobile): adr for expo + metro + testing strategy`.

2. [ ] **Intent:** Scaffold `apps/mobile/` minimal package —
   `package.json` with Expo SDK 55 / Expo Router 55 / jest-expo / RNTL
   / msw / msw native deps; `tsconfig.json` extending the web app's
   strict settings; `babel.config.js` Expo preset; `metro.config.js`
   with pnpm symlink support; `app.json` with identifier
   `dev.matthewcarr.travelplanner`. **Verification:** `pnpm install`
   succeeds, `pnpm --filter @travel-planner/mobile type-check` exits 0.
   **Commit:** `feat(mobile): expo sdk 55 scaffold with pnpm metro config`.

3. [ ] **Intent:** Write the Hello screen and its Jest render test.
   Write `jest.config.js` + `jest.setup.ts`. Add `mobile:test` script.
   **Verification:** `pnpm mobile:test` exits 0 with 1 passing test.
   **Commit:** `feat(mobile): hello screen + jest harness`.

4. [ ] **Intent:** Write `.maestro/flows/launch.yaml`. Add
   `mobile:e2e` script. Verify locally by running against iOS
   Simulator. **Verification:** Local `pnpm mobile:e2e` exits 0 with
   the assert-visible passing. **Commit:** `feat(mobile): maestro launch flow`.

5. [ ] **Intent:** Add four mobile CI jobs (`mobile-lint`,
   `mobile-typecheck`, `mobile-unit-test`, `mobile-e2e`) to
   `.github/workflows/ci.yml` with path filters. **Verification:**
   Push the branch; the mobile jobs all run on this PR (since
   `apps/mobile/**` changed); a probe branch touching only a
   web-only file shows mobile jobs skipped. **Commit:** `ci: mobile path-filtered jobs`.

6. [ ] **Intent:** Add `apps/mobile/AGENTS.md` (+ `CLAUDE.md` symlink)
   documenting layout, testID convention, dev loop, doc-review table.
   Add `pnpm dev:mobile`, `pnpm mobile:test`, `pnpm mobile:e2e` to
   root `package.json`. Add a "Mobile" subsection to repo `README.md`
   covering the QR-code dev loop. **Verification:** `cat
   apps/mobile/CLAUDE.md` resolves to AGENTS.md. **Commit:** `docs(mobile): agents.md + dev loop docs`.

7. [ ] **Intent:** Update `CHANGELOG.md` under `[Unreleased]`. Bump
   the ADR to `Accepted` and update `docs/decisions/README.md`. Mark
   EPIC-001 §7 slice 5 row as **Done** with "merged with slice 8";
   mark slice 8 row as **Done** (merged); update slice ledger; add
   "Epic-level deviations" entry to §16. Update `docs/specs/README.md`
   index. **Verification:** Full verification suite green; `pnpm
   build` succeeds. **Commit:** `feat(mobile): close slice 5 + merge slice 8`.

7 commits in this slice (vs the typical 4–6); reflects the merged
scope. Each commit still small and reviewable on its own.

## 13. ADR triggers and tech-debt review

### ADR?

- [x] **New library, external tool, or vendor** — Expo, Expo Router,
      Jest+jest-expo, RNTL, msw, Maestro
- [x] **CI pipeline or workflow structural change** — four new
      path-filtered jobs, first macOS runner
- [x] **New project-wide standard** — mobile testing strategy,
      testID convention
- [x] **Non-obvious architectural trade-off** — Metro
      `unstable_enableSymlinks` over `node-linker=hoisted`; Jest over
      Vitest (reaffirmed); manual scaffold over `create-expo-app`
- [x] Cross-cutting decision not already settled by the parent epic —
      yes (this slice's ADR is the consolidated mobile-foundation
      record)

**ADRs to write:** **Mobile Application Foundation: Expo, Metro, and
Testing Strategy** — drafted in step 1, accepted in step 7. Number
claimed at write time. Title is intentionally umbrella-shaped because
EPIC §16 had separate slice-5 and slice-8 ADRs in mind; merging the
slices merges the ADRs.

### Tech debt

- [x] I reviewed `docs/tech-debt.md` — register is empty post the
  recent chore. No items addressed in this slice.

## 14. Risks & open questions

- **Metro symlink plugin maturity** — `unstable_enableSymlinks` has
  been reliable for SDK 51+, but the `unstable_` prefix hedges.
  Fallback: switch to `node-linker=hoisted`. Documented in the ADR.
- **macOS CI runner cost.** Path filter is load-bearing. If silently
  broken, CI minutes drain. Mitigation: PR description shows which
  jobs ran; a smoke check on the first non-mobile PR after slice 5
  confirms the filter works.
- **Partner-device validation** — deferred to slice 6 prerequisite.
  Visible in this SPEC's §6, in EPIC §13 Q1, and in the upcoming
  `apps/mobile/AGENTS.md`. The §9 partner-device kill criterion fires
  if it fails.
- **Open question:** when slice 6 lands, will we need a real
  TypeScript path alias setup (`@travel-planner/mobile/...`) similar
  to `apps/web`'s? Likely yes once components are organised into
  subdirectories. Deferred — slice 6 SPEC will decide.

---

## Implementation Deviations

> Capture in `docs/implementation-notes/SPEC-003-mobile-app-foundation.md`
> during implementation; triage at close-out.

| # | Deviation | Reason | Impact | Resolved? |
|---|-----------|--------|--------|-----------|
| 1 | _none yet_ | | | |

### Post-Implementation Notes

_To be filled at close-out._
