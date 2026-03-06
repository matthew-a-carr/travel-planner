# ADR 019: Preview Local-Dev Auth Override via AUTH_ENABLE_LOCAL_DEV

**Date:** 2026-03-06
**Status:** Accepted

## Context

Current auth behavior enables local-dev credentials only when
`NODE_ENV=development`. Vercel preview deployments run with
`NODE_ENV=production`, which prevents local-dev login in previews.

Requirement: preview environments should avoid SSO while production remains
SSO-only.

## Decision

Extend local-dev auth enablement logic to allow explicit override via
`AUTH_ENABLE_LOCAL_DEV=true`.

Effective rule:

- enabled when `NODE_ENV=development`, or
- enabled when `AUTH_ENABLE_LOCAL_DEV` is truthy (`1`, `true`, `yes`, `on`).

Terraform sets:

- Preview: `AUTH_ENABLE_LOCAL_DEV=true`
- Production: `AUTH_ENABLE_LOCAL_DEV=false`

## Consequences

### Positive

- Preview deployments can use local-dev credentials without enabling SSO.
- Production remains explicitly locked to SSO-only behavior.

### Negative / Trade-offs

- Misconfiguration risk if production flag is set incorrectly.
- Requires explicit environment variable governance in IaC.

## Alternatives considered

- Force `NODE_ENV=development` in preview: rejected due to behavior drift.
- Use Google SSO in preview: rejected by requirement.
