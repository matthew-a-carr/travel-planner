# Mobile App — AGENTS.md

> Rules for `apps/mobile/`. These add specificity to the root AGENTS.md.
>
> The mobile app is an Expo + React Native client that talks to the
> `/api/v1/*` surface from the web app. Per ADR 045 / 052: Expo SDK
> 55 + Expo Router + Expo Go for the entire EPIC-001 phase
> (TestFlight / EAS Build deferred to EPIC-002).

## Quick reference

| Concern | Where |
|---------|-------|
| App entry | `app/_layout.tsx` (root Stack) |
| Screens | `app/*.tsx` (Expo Router, file-system routing) |
| Component tests | co-located `*.test.tsx` next to source |
| E2E flows | `.maestro/flows/*.yaml` (one per user journey) |
| API mocks | `__mocks__/msw-server.ts` (added when the first API call ships) |
| Metro pnpm config | `metro.config.js` — **do not touch without reading ADR 052** |
| Test framework setup | `jest.config.js` + `jest.setup.ts` |
| App identifier | `app.json` → `expo.ios.bundleIdentifier` (`dev.matthewcarr.travelplanner`) |
| URL scheme | `app.json` → `expo.scheme` (`travelplanner://`) |

## Dev loop

From the repo root:

```bash
pnpm dev:mobile        # starts Expo Metro; prints QR code
pnpm mobile:test       # Jest unit + component tests
pnpm mobile:e2e        # Maestro E2E (requires Maestro + iOS Simulator locally)
pnpm --filter @travel-planner/mobile type-check
pnpm lint              # repo-wide Biome — lints apps/mobile/app/** + apps/mobile/*.{ts,tsx,js,mjs} via biome.json includes
```

To run on the author's iPhone: scan the QR with the Expo Go app
(install from App Store). Expo Go runs the unsigned bundle
indefinitely — no Apple Developer Program required.

To run on the iOS Simulator: press `i` in the Metro CLI after
`pnpm dev:mobile`.

## Architecture

For slice 5 the app is a single screen. As slices 6+ add navigation,
state, and API calls, the conventions below come into force.

### File-system routing (Expo Router)

- `app/index.tsx` is the entry screen.
- `app/<name>.tsx` is a route at `/<name>`.
- `app/<name>/<sub>.tsx` is a nested route.
- `app/_layout.tsx` wraps a directory with a layout component.
- Modal/transparent presentations: see Expo Router docs.

### TestID convention (load-bearing for Maestro)

Every interactive element AND every screen-root view MUST carry a
stable `testID`. Naming pattern: `<screen>-<element>`.

Examples:

- Root `<View>` of `app/index.tsx` → `testID="hello-screen-root"`
- Login Google button → `testID="login-google-button"`
- Me screen sign-out → `testID="me-screen-sign-out"`

Maestro flows reference these rather than visible text. Text
changes are cheap; testID changes break flows.

### Component testing (Jest + RNTL)

Co-located: `Foo.tsx` → `Foo.test.tsx`. Use `@testing-library/react-native`
queries (`screen.getByTestId`, `screen.getByText`, etc.). Extend-expect
matchers (`toBeOnTheScreen`, `toHaveTextContent`) are wired in
`jest.setup.ts`.

```tsx
import { render, screen } from '@testing-library/react-native';
import MyScreen from './my-screen';

describe('MyScreen', () => {
  it('renders the heading', () => {
    render(<MyScreen />);
    expect(screen.getByTestId('my-screen-heading')).toBeOnTheScreen();
  });
});
```

### API mocking (msw/native, slice 6+)

When slice 6's sign-in screen lands, add `__mocks__/msw-server.ts`
exporting an msw server; uncomment the lifecycle hooks in
`jest.setup.ts`. Mock handlers live in `__mocks__/handlers/*.ts`.

### Maestro flows (E2E)

One YAML per user journey under `.maestro/flows/`. Examples:

- `launch.yaml` — app boots and the Hello screen renders.
- `login.yaml` — slice 6's sign-in journey.
- `me-screen.yaml` — slice 7's milestone journey.

Use `id:` selectors over visible-text selectors where possible.

## Pnpm + Metro

The repo uses pnpm's isolated linker. Metro's default module
resolution doesn't understand pnpm's symlinked layout. `metro.config.js`
enables `unstable_enableSymlinks` and points `watchFolders` at the
workspace root. **Do not change this file** without reading ADR 052 —
the alternative (`node-linker=hoisted` globally) forfeits pnpm
strictness for the web app, which architecture tests depend on.

## Doc review — keeping mobile docs true

| You changed… | Check these docs |
|---|---|
| `app/` structure or routing | This file's "Architecture" section |
| Add a new screen / Maestro flow / testID convention | This file's "Quick reference" + an entry per convention |
| `metro.config.js` | ADR 052; smoke-test that `pnpm dev:mobile` still resolves all imports |
| Expo SDK version (`package.json`) | ADR 052's "Expo SDK 55 + Expo Router 55" section; verify jest-expo + RNTL versions still match |
| `app.json` (`bundleIdentifier`, `scheme`) | ADR 052; any active Maestro flows referencing the bundleIdentifier |
| CI workflow (mobile jobs in `.github/workflows/ci.yml`) | This file's "Dev loop" section; ADR 052's CI table |

## Prerequisites for future slices

These are tracked here because they don't belong in the SPEC files
they depend on (the prerequisite is "future-you ran a test before
opening the next SPEC").

- [ ] **Partner-device Expo Go validation** — before slice 6 begins,
  the partner must successfully install Expo Go on her iPhone, scan
  the project URL, and see the Hello screen. If this fails, EPIC-001
  §9's partner-device kill criterion fires; slice 6 is re-planned
  (PWA pivot or fast-track EAS Build via funded Apple Developer
  Program). See SPEC-003 §6.
- [ ] **`mobile-e2e` CI job actually runs flows** — currently a
  placeholder per TD-002. Land the simulator-boot + dev-client build
  wiring before slice 6 introduces a `login.yaml` Maestro flow that
  also needs to run.
