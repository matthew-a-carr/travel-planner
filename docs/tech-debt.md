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
| TD-004 | 2026-05-20 | SPEC-004 | Transition mobile auth from server-mediated PKCE (current; web `AUTH_GOOGLE_ID` client) to direct on-device OAuth via Expo Auth Session with a real iOS-type Google client + native redirect URI. ADR 051 §3's server-mediated flow can't use Google's iOS-type client (those require `com.googleusercontent.apps.X:/callback`-style native redirect URIs). Transition requires: (a) registering an iOS-type client in Google Cloud Console; (b) adding `expo-auth-session` to `apps/mobile/`; (c) reshaping `/api/v1/auth/mobile/*` so the server only receives a Google-issued auth code or ID token rather than initiating the OAuth dance; (d) deprecating `mobile_auth_states` + reshape of `mobile_auth_exchange_codes`. **Trigger:** EPIC-002 funds the Apple Developer Program and moves distribution to TestFlight (App Store readiness implies the iOS-native auth UX). ~2d chore + ADR amendment to ADR 051 §3. | Low (Medium once ADP funded) | unowned |
| TD-005 | 2026-05-20 | dependabot | Two open dependabot alerts, both transitive dev-only deps with no production runtime impact: (a) **#1 — esbuild < 0.25.0 (medium, GHSA-67mh-4wv8-2f99)** via `drizzle-kit@0.31.10 → @esbuild-kit/esm-loader → @esbuild-kit/core-utils → esbuild@0.18.20`. Fix: bump `drizzle-kit` or add a `pnpm.overrides` entry for the `esbuild-kit` chain. (b) **#43 — @tootallnate/once < 3.0.1 (low, GHSA-vpq2-c234-7xj6)** via `vitest@4.1.5 → jsdom@20.0.3 → http-proxy-agent@5.0.0 → @tootallnate/once@2.0.1`. Fix: bump `vitest` (likely already addressed in a newer minor) or override `http-proxy-agent` to a version that no longer pulls the vulnerable transitive. Both are dev-server / test-runtime exposures only; production builds are unaffected. ~half-day chore; bundle with the next routine dependabot security pass. | Low | unowned |

## Resolved Items

| ID | Date Added | Date Resolved | Source Spec | Description | Resolution |
|----|------------|---------------|-------------|-------------|------------|
| TD-001 | 2026-05-20 | 2026-05-20 | SPEC-001 | `pnpm-workspace.yaml` had stale `allowBuilds:` placeholders blocking local installs on pnpm v11. | Replaced placeholders with explicit booleans (`true` for the deps whose postinstalls we need; `false` for `sharp`). Bundled with a Dependabot security pass: `postcss → 8.5.15` and `vite → 7.3.3` via `pnpm-workspace.yaml` `overrides:` + a direct `vite` devDep on `apps/web` because the override alone didn't dislodge the resolved 7.3.1. All 4 Dependabot alerts (2 high, 2 medium) closed. |
