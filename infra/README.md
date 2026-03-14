# Terraform Infrastructure

This directory manages production and preview infrastructure for Travel Planner.

## Layout

- `stacks/prod`: Production stack (state: `travel-planner-prod`)
- `stacks/preview`: Preview stack (state: `travel-planner-preview`)
- `modules/vercel-project`: Vercel project + domain + environment variables
- `modules/sentry-project`: Sentry error tracking project and alerts
- `modules/neon-project`: Neon project baseline
- `modules/preview-branches`: Per-PR Neon branches/endpoints/roles/databases

## State Strategy

Terraform Cloud stores state in separate workspaces per stack:

- `travel-planner-prod`
- `travel-planner-preview`

No Terraform CLI workspaces are used.

## Build and Migration Behavior

Production deployments run:

```bash
pnpm build && pnpm db:migrate:deploy && pnpm db:seed
```

`db:migrate:deploy`:

- validates migration SQL transaction safety (`pnpm db:check:migrations`)
- acquires a PostgreSQL advisory lock
- runs Drizzle migrations
- fails deployment on error (transaction rollback)

## Validation

```bash
terraform -chdir=infra/stacks/prod init -backend=false
terraform -chdir=infra/stacks/prod validate

terraform -chdir=infra/stacks/preview init -backend=false
terraform -chdir=infra/stacks/preview validate
```

## Secrets

Store provider credentials and runtime secrets in Terraform Cloud sensitive variables.
Do not commit real tokens or connection strings.

Production stack additionally manages invite email runtime variables:
- `RESEND_API_KEY` (sensitive)
- `EMAIL_FROM_ADDRESS`
- `EMAIL_FROM_NAME`
