# Sentry Operations Runbook

## Overview

Sentry captures client-side and server-side errors from the Travel Planner
Next.js application. The Sentry project and alerts are managed by Terraform
in `infra/stacks/prod` via the `infra/modules/sentry-project` module.

## Environments

| Environment | Sentry tag | When used |
|---|---|---|
| `production` | `environment:production` | `main` branch deploys to `travel.matthewcarr.dev` |
| `preview` | `environment:preview` | PR and branch deploys on Vercel preview URLs |
| `development` | `environment:development` | Local `pnpm dev` (events only sent if DSN is set) |

## Terraform-managed resources

- `sentry_project.this` — the Sentry project (`travel-planner`)
- `sentry_issue_alert.new_issue` — fires on first occurrence of a new issue
- `sentry_issue_alert.regression` — fires when a resolved issue regresses
- `sentry_issue_alert.reappeared` — fires when an ignored issue reappears
- `sentry_issue_alert.high_error_rate` — fires when >10 events in 5 min
- `sentry_metric_alert.error_count` — fires at 20 (warning) / 50 (critical) errors in 5 min
- Vercel env vars: `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN`

## Manual setup required (provider gaps)

### Uptime monitor

1. Go to **Sentry → Alerts → Create Alert → Uptime Monitor**.
2. URL: `https://travel.matthewcarr.dev`
3. Check interval: 1 minute.
4. Notification target: your email / team.

### Dashboard

1. Go to **Sentry → Dashboards → Create Dashboard**.
2. Add widgets:
   - Error count over time (filter: `environment:production`)
   - Top 5 issues by count
   - Issues by environment comparison
3. Save and note the URL in this file for quick access.

## Testing the integration

### Server-side error

```bash
curl https://travel.matthewcarr.dev/api/sentry-example-api
```

This endpoint throws a test error. Confirm the event appears in Sentry
within 30 seconds.

### Client-side error

Open the browser console on any page and run:

```js
throw new Error("Sentry client test");
```

Confirm the event appears in Sentry under the correct environment.

## Rotating the SENTRY_AUTH_TOKEN

1. Create a new token at **sentry.io → Settings → Auth Tokens** (scopes: `project:write`, `org:read`).
2. Update the `SENTRY_AUTH_TOKEN` secret in GitHub repository settings.
3. Re-run the Terraform prod and preview workflows to propagate the new
   value to Vercel env vars.

## Adding a new app

1. Create a new module instance in the relevant Terraform stack:
   ```hcl
   module "sentry_new_app" {
     source       = "../../modules/sentry-project"
     organization = var.sentry_org
     team         = var.sentry_team
     project_name = "new-app-name"
   }
   ```
2. Add `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT`,
   `SENTRY_AUTH_TOKEN` env vars for the new Vercel project.
3. Install `@sentry/nextjs` in the new app and copy the
   `sentry.*.config.ts` files / `instrumentation.ts` pattern.
4. Run `terraform apply` then deploy the app.

## Free tier budget

| Resource | Sentry free tier limit | Current config |
|---|---|---|
| Errors | 5,000 / month | All unhandled exceptions captured |
| Performance units | 10,000 / month | 5% sample rate in production |
| Replay | — | Replay disabled (0% sample rate) |

Monitor usage at **sentry.io → Settings → Subscription**.
