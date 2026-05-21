# Implementation Notes — SPEC-006: Mobile Sign-In UI + PKCE Flow + Keychain

**Spec:** [SPEC-006-mobile-sign-in-pkce-keychain](../specs/SPEC-006-mobile-sign-in-pkce-keychain.md)
**Started:** 2026-05-20

> Rolling log written by the implementing agent. Append new entries at the
> bottom as they happen — do not rewrite history. Each entry is a single
> observation, decision, or surprise. At spec close-out, every entry is
> triaged into one of: spec deviations table, spec post-implementation notes,
> docs/tech-debt.md, or discarded.

## Entries

### 2026-05-20 22:00 — Step 4: pre-existing `setupFilesAfterEach` typo in jest.config.js

**Step:** Step 4 — apiClient.ts + tests
**Type:** surprise

**Note:**

`apps/mobile/jest.config.js` declared `setupFilesAfterEach: ['<rootDir>/jest.setup.ts']`.
Every jest run since SPEC-003 has emitted a validation warning:
"Unknown option `setupFilesAfterEach` ... probably a typing mistake."
Confirmed against `jest-config@29.7.0/build/ValidConfig.js` — the
canonical name is `setupFilesAfterEnv`. The setup file works in
practice because jest still attempts to load it via the bad option
key in some path. The fix is one character.

Renamed to `setupFilesAfterEnv` in the same commit as the rest of
step 4's plumbing. No behaviour change expected, just lose the
warning noise on every run.

**Companion finding (same step 4 commit):** `jest.setup.ts` imported
`'@testing-library/react-native/extend-expect'`, which doesn't exist
in RNTL v13 — the canonical subpath is `'/matchers'`. The broken
import had been silently masked by the setupFilesAfterEach typo
(jest skipped the whole setup file). Fixed in the same commit.

**Triage:** post-impl-note — both fixes are pre-existing SPEC-003
bugs unrelated to slice 6's design. Captured under "Side-quest
fixes" in the spec's Post-Implementation Notes; no design-deviation
to log.

---

### 2026-05-20 23:00 — Step 9: EAS Local → raw xcodebuild for CI dev-client build

**Step:** Step 9 — TD-002 pay-down (mobile-e2e CI per ADR-055)
**Type:** deviation

**Note:**

ADR-055 draft (committed alongside SPEC-006 planning) named
`eas build --local --profile development --platform ios` as the
build step. Started implementing it; found two friction points:

1. `eas build --local` requires the project to be linked to an EAS
   account (an `extra.eas.projectId` in `app.json`). Without it,
   the CLI prompts; with `--non-interactive`, it errors. The
   "linked" project can be a fictitious UUID for `--local` builds
   (no cloud comms happens), but that's a hack and EAS upstream
   could tighten the validation later.
2. The EAS CLI isn't installed by default; needs `pnpm dlx eas-cli`
   or a direct devDep. Adds a third-party tool to the CI critical
   path that's only used for one step.

Switched to raw `xcodebuild`: `expo prebuild --platform ios --clean`
to generate `ios/`, `pod install` to fetch CocoaPods, then
`xcodebuild -workspace ... -scheme ... -configuration Debug -sdk
iphonesimulator -derivedDataPath build CODE_SIGNING_ALLOWED=NO`
produces the `.app`. CocoaPods + Xcode + iOS Simulator are
preinstalled on `macos-latest` GitHub runners — zero external
account, zero new devDeps, zero new CLI tools.

ADR-055 amended in the same commit as step 9's CI yaml: title
rebadged to "Mobile E2E via Local Dev-Client Build in CI (`expo
prebuild` + `xcodebuild`)"; Decision section §5 rewritten to
describe the xcodebuild step. Filename unchanged to preserve the
existing cross-references from SPEC-006.

The job stays `continue-on-error: true` for week 1 — this is the
first real run of the pipeline so failures (Xcode version drift,
scheme name auto-derivation, simulator boot timing, CocoaPods
mismatches) will surface in PR runs and be ironed out
empirically.

**Triage:** spec-deviation #1 — diverges from ADR-055's original
"EAS Local" draft. ADR-055 was amended in the same commit to
match what landed; the deviation is captured both there and in
the spec's Implementation Deviations table.

---

### 2026-05-20 22:30 — Step ordering swap: 7 before 6 (signed-in placeholder lands first)

**Step:** Step 7 → Step 6
**Type:** decision

**Note:**

SPEC-006 §12 lists step 6 (rewrite `app/index.tsx`) before step 7
(`app/signed-in.tsx` placeholder). With `app.json`'s
`experiments.typedRoutes: true`, Expo Router infers the valid route
union from the `app/` directory contents at type-check time. Step 6
needs to call `router.replace({ pathname: '/signed-in', params: {
email } })` — but `'/signed-in'` doesn't exist as a route yet, so
the typed-route narrowing would reject it.

Swap the order: do step 7 first (5-line route file + tiny render
test), then step 6 (the meaty screen + state machine). No
load-bearing dependency in either direction so the swap is
mechanical.

**Triage:** post-impl-note — purely an execution-order observation;
the spec's design intent stayed identical.

---

### 2026-05-20 22:05 — Step 4: msw 2.x + jest-expo 54 ESM transitive friction; switched to global fetch spy

**Step:** Step 4 — apiClient.ts + tests
**Type:** deviation

**Note:**

SPEC-006 §7 and `apps/mobile/AGENTS.md` (inherited from SPEC-003)
both pointed at msw for HTTP mocking. Initial attempt: import
`server` from a new `__mocks__/msw-server.ts`, activate the
beforeAll/afterEach/afterAll lifecycle hooks in `jest.setup.ts`,
write apiClient tests using `server.use(http.post(...))` handlers.

Jest blew up loading the test file with
`SyntaxError: Cannot use import statement outside a module` on
`rettime/build/index.mjs`. msw 2.x ships a stack of ESM-only
transitive deps (`rettime`, `until-async`, `outvariant`,
`strict-event-emitter`, `@bundled-es-modules/*`, ...) that
jest-expo's inherited `transformIgnorePatterns` (from
react-native's preset, `node_modules/(?!((jest-)?react-native|@react-native(-community)?))/`)
excludes from transformation.

Two paths considered:

- **Make msw work:** expand `transformIgnorePatterns` to also allow
  `msw|@mswjs/.*|rettime|until-async|outvariant|strict-event-emitter|@bundled-es-modules/.*|headers-polyfill|is-node-process`,
  plus `moduleNameMapper` entries for `@bundled-es-modules/cookie`
  and similar bundled deps. ~10+ lines of jest config. Carries
  ongoing maintenance cost as msw's transitive graph shifts.
- **Use `jest.spyOn(globalThis, 'fetch')`:** Node 18+ has global
  fetch; jest can spy on it directly. Tests construct `Response`
  objects and return them from the spy. Zero third-party surface
  area, no transform config, no ESM gotchas across RN upgrades.

Picked the spy approach. Reasoning aligned with the durable-bias
directive (AGENTS.md): "zero new third-party surface" is more
durable than "fight transitive-ESM transforms forever." If a future
spec needs richer scenarios (msw's request matching, response
templating, multi-handler routing), reopen the msw question with
that test in mind.

Consequences:

- `apps/mobile/__mocks__/msw-server.ts` deleted (was only added in
  this slice).
- `jest.setup.ts` reverts to not activating any HTTP lifecycle
  (the `extend-expect` import stays).
- `msw` stays in `apps/mobile/devDependencies` (it's harmless and
  removing it is gratuitous churn — leave for the future spec that
  decides to use it).
- `apps/mobile/AGENTS.md` "API mocking" section needs amending —
  drop the "uncomment the lifecycle hooks in jest.setup.ts" note;
  point at the fetch-spy pattern with a short example.

**Triage:** spec-deviation #2 — design diverges from SPEC-006 §7
(which inherited "msw/native" from SPEC-003's anticipatory note).
Captured in the spec's Implementation Deviations table.

---

## Close-out triage summary

> Filled at the very end. One line per entry above plus where it landed.

| Entry | Landed in |
|-------|-----------|
| 1 — `setupFilesAfterEach` typo + RNTL `extend-expect` → `matchers` (pre-existing SPEC-003 bugs) | Post-Implementation Notes — "Side-quest fixes". |
| 2 — Step 9 EAS Local → raw xcodebuild for CI dev-client build | Spec deviation #1 + ADR-055 amended in-place. |
| 3 — Step ordering swap (7 before 6) | Post-Implementation Notes — execution-order observation. |
| 4 — msw → `jest.spyOn(globalThis, 'fetch')` for HTTP mocking | Spec deviation #2. |

