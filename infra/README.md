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
terraform -chdir=infra/stacks/preview test
```

Use Terraform 1.12.x, matching the stack constraint and CI. The preview tests mock
both providers and keep state in memory: they create no cloud resources and need
no credentials. They exercise old-preview creation, targeted cleanup while a new
preview is requested, and the subsequent full apply. URL outputs follow included
database resources so the cleanup pass does not index previews outside its plan.

## Secrets

Store provider credentials and runtime secrets in Terraform Cloud sensitive variables.
Do not commit real tokens or connection strings.

Production stack additionally manages invite email runtime variables:
- `RESEND_API_KEY` (sensitive)
- `EMAIL_FROM_ADDRESS`
- `EMAIL_FROM_NAME`
