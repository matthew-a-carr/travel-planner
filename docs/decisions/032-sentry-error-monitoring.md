# ADR 032: Sentry Error Monitoring

**Date:** 2026-03-09
**Status:** Accepted

## Context

The application had no error monitoring. Unhandled exceptions in production
went unnoticed until users reported them. The stack already uses Terraform
for all infrastructure (Vercel project, Neon database, env vars) so any
observability tooling should follow the same IaC pattern.

## Decision

Adopt **Sentry** (`@sentry/nextjs`) for error monitoring and basic
performance tracing across the Next.js App Router application.

### Provider & resource strategy

- **Sentry Terraform provider** (`jianyuan/sentry ~> 0.15`) manages the
  project, issue alerts, and metric alerts.
- **`data.sentry_key`** retrieves the public DSN and injects it into
  Vercel env vars via the existing `vercel-project` module pattern.
- **Uptime monitors and dashboards** are not available as Terraform
  resources in the current provider version — they must be created
  manually in the Sentry UI and are documented in `docs/operations/sentry.md`.

### Tracing budget

`tracesSampleRate` is `0.05` (5%) in production and `0` elsewhere to stay
within the Sentry free tier (50 K errors + 10 K performance units / month).

### Environment model

`production` and `preview` environments, consistent with the existing
Vercel target and Terraform stack naming.

### SDK integration

- `sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`
  at repo root.
- `src/instrumentation.ts` for Next.js App Router server/edge hookup.
- `src/app/global-error.tsx` for React render error capture.
- `next.config.ts` wrapped with `withSentryConfig` for source map upload
  and auto-instrumentation.

## Consequences

- **Easier:** production errors are visible immediately with readable stack
  traces. Alerts fire on new issues, regressions, and high error rates.
- **Harder:** an additional Terraform provider and ~10 managed resources
  count toward the HCP Terraform free-tier 500-resource cap. The Sentry
  auth token must be bootstrapped as a GitHub secret before the first
  Terraform apply.
- **Gap:** dashboards and uptime monitors require manual Sentry UI setup
  until the provider adds support. This is documented in the operations
  runbook.
