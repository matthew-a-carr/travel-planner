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
| — | — | — | _No outstanding items_ | — | — |

## Resolved Items

| ID | Date Added | Date Resolved | Source Spec | Description | Resolution |
|----|------------|---------------|-------------|-------------|------------|
| TD-001 | 2026-05-20 | 2026-05-20 | SPEC-001 | `pnpm-workspace.yaml` had stale `allowBuilds:` placeholders blocking local installs on pnpm v11. | Replaced placeholders with explicit booleans (`true` for the deps whose postinstalls we need; `false` for `sharp`). Bundled with a Dependabot security pass: `postcss → 8.5.15` and `vite → 7.3.3` via `pnpm-workspace.yaml` `overrides:` + a direct `vite` devDep on `apps/web` because the override alone didn't dislodge the resolved 7.3.1. All 4 Dependabot alerts (2 high, 2 medium) closed. |
