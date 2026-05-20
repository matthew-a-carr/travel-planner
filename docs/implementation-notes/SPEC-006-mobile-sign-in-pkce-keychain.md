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

**Triage (filled at close-out):**

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

**Triage (filled at close-out):**

---

## Close-out triage summary

> Filled at the very end. One line per entry above plus where it landed.

| Entry | Landed in |
|-------|-----------|
