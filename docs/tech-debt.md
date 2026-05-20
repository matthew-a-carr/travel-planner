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
| TD-001 | 2026-05-20 | SPEC-001 | `pnpm-workspace.yaml` has stale `allowBuilds:` placeholder entries (`'@sentry/cli': set this to true or false`) that block local installs on pnpm v11+. CI uses pnpm v10 and is unaffected, but every contributor on a fresh machine with current pnpm hits this. Fix: replace `allowBuilds:` with `onlyBuiltDependencies:` listing the deps that genuinely need build scripts (`@sentry/cli`, `bufferutil`, `cpu-features`, `esbuild`, `protobufjs`, `ssh2`), drop the placeholder values, leave `sharp` in `ignoredBuiltDependencies`. ~5 min chore. | Low | unowned |

## Resolved Items

| ID | Date Added | Date Resolved | Source Spec | Description | Resolution |
|----|------------|---------------|-------------|-------------|------------|
| — | — | — | — | _No resolved items yet_ | — |
