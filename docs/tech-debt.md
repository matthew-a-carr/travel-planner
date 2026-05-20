# Tech Debt Register

> This file captures known technical debt. Items are added during
> feature implementation when deviations from a spec cannot be resolved
> immediately. Items are removed (moved to Resolved) when the debt is
> paid down.
>
> **Review cadence:** Before planning any new spec, review this register.
> If any outstanding items are relevant to the new feature or can be
> addressed alongside it, include them in the spec's implementation order.
> Additionally, this register should be reviewed periodically (weekly or
> on-demand) to identify items that warrant their own spec.

## Outstanding Items

| ID | Date | Source Spec | Description | Severity | Owner |
|----|------|-------------|-------------|----------|-------|
| TD-002 | 2026-05-20 | SPEC-003 | `mobile-e2e` GitHub Actions job is a placeholder. Path filter + macOS runner + Maestro install work; full simulator-boot-and-test wiring deferred. Expo Go can't be sideloaded into a CI simulator, so the real fix is an `expo prebuild` + EAS Local build for a dev-client, then `maestro test`. ~half-day chore. Land before slice 6 (login flow needs its own Maestro flow that would also be skipped today). | Medium | unowned |
| TD-003 | 2026-05-20 | EPIC-001 / ADR 053 | `apps/mobile/` is on Expo SDK 54 (was SDK 55) because App Store Expo Go does not yet support SDK 55 (per Expo's 2026-05-04 [changelog](https://expo.dev/changelog/expo-go-and-app-store-may-2026): "stuck in Apple's approval process with no clear timeline"). Re-upgrade to SDK 55 when **either** (a) Expo Go's About screen on the App Store version shows SDK 55, **or** (b) EPIC-002 funds Apple Developer Program and moves distribution to `eas go` via TestFlight (making App Store compat irrelevant). Re-upgrade is `pnpm --filter @travel-planner/mobile exec expo install --fix` after bumping `expo` to `^55.x`, plus realigning `react`, `react-native`, `react-test-renderer`, `@types/react`, `jest-expo`, then a mobile test + type-check pass. ~half-day chore. | Low | unowned |

## Resolved Items

| ID | Date Added | Date Resolved | Source Spec | Description | Resolution |
|----|------------|---------------|-------------|-------------|------------|
| TD-001 | 2026-05-20 | 2026-05-20 | SPEC-001 | `pnpm-workspace.yaml` had stale `allowBuilds:` placeholders blocking local installs on pnpm v11. | Replaced placeholders with explicit booleans (`true` for the deps whose postinstalls we need; `false` for `sharp`). Bundled with a Dependabot security pass: `postcss → 8.5.15` and `vite → 7.3.3` via `pnpm-workspace.yaml` `overrides:` + a direct `vite` devDep on `apps/web` because the override alone didn't dislodge the resolved 7.3.1. All 4 Dependabot alerts (2 high, 2 medium) closed. |
