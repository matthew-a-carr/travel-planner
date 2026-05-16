module "neon" {
  source = "../../modules/neon-project"

  project_name = "travel-planner-prod"
  org_id       = trimspace(var.neon_org_id) == "" ? null : var.neon_org_id
  region_id    = var.neon_region_id
}

module "sentry" {
  source = "../../modules/sentry-project"

  organization = var.sentry_org
  team         = var.sentry_team
}

locals {
  production_environment_variables = [
    {
      key       = "POSTGRES_URL"
      value     = module.neon.connection_uri
      target    = toset(["production"])
      sensitive = true
      comment   = "Managed by Terraform: production Neon connection string"
    },
    {
      key       = "AUTH_SECRET"
      value     = var.auth_secret
      target    = toset(["production"])
      sensitive = true
      comment   = "Managed by Terraform: production Auth.js secret"
    },
    {
      key       = "AUTH_GOOGLE_ID"
      value     = var.auth_google_id
      target    = toset(["production"])
      sensitive = true
      comment   = "Managed by Terraform: production Google OAuth client ID"
    },
    {
      key       = "AUTH_GOOGLE_SECRET"
      value     = var.auth_google_secret
      target    = toset(["production"])
      sensitive = true
      comment   = "Managed by Terraform: production Google OAuth secret"
    },
    {
      key       = "AUTH_URL"
      value     = "https://${var.production_domain}"
      target    = toset(["production"])
      sensitive = false
      comment   = "Managed by Terraform: canonical production auth URL"
    },
    {
      key       = "AUTH_TRUST_HOST"
      value     = "true"
      target    = toset(["production"])
      sensitive = false
      comment   = "Managed by Terraform: trust production host for Auth.js"
    },
    {
      key       = "AUTH_ENABLE_LOCAL_DEV"
      value     = "false"
      target    = toset(["production"])
      sensitive = false
      comment   = "Managed by Terraform: disable local-dev auth in production"
    },
    {
      key       = "RESEND_API_KEY"
      value     = var.resend_api_key
      target    = toset(["production"])
      sensitive = true
      comment   = "Managed by Terraform: production Resend API key"
    },
    {
      key       = "EMAIL_FROM_ADDRESS"
      value     = var.email_from_address
      target    = toset(["production"])
      sensitive = false
      comment   = "Managed by Terraform: invite email sender address"
    },
    {
      key       = "EMAIL_FROM_NAME"
      value     = var.email_from_name
      target    = toset(["production"])
      sensitive = false
      comment   = "Managed by Terraform: invite email sender display name"
    },
    {
      key       = "NEXT_PUBLIC_SENTRY_DSN"
      value     = module.sentry.dsn_public
      target    = toset(["production"])
      sensitive = false
      comment   = "Managed by Terraform: Sentry public DSN for client-side error capture"
    },
    {
      key       = "SENTRY_ORG"
      value     = var.sentry_org
      target    = toset(["production"])
      sensitive = false
      comment   = "Managed by Terraform: Sentry organisation slug for source map upload"
    },
    {
      key       = "SENTRY_PROJECT"
      value     = module.sentry.project_slug
      target    = toset(["production"])
      sensitive = false
      comment   = "Managed by Terraform: Sentry project slug for source map upload"
    },
    {
      key       = "SENTRY_AUTH_TOKEN"
      value     = var.sentry_auth_token
      target    = toset(["production"])
      sensitive = true
      comment   = "Managed by Terraform: Sentry auth token for build-time source map upload"
    },
  ]
}

# AI Gateway authentication
#
# Vercel deployments authenticate to the AI Gateway via OIDC. At runtime the
# token arrives per-request as the `x-vercel-oidc-token` header (the
# `VERCEL_OIDC_TOKEN` env var is only populated at build time). OIDC is
# enabled on the project via `oidc_token_config` in the vercel-project
# module — without that, no token is issued and the app falls back to the
# no-op AI services. Local dev / non-Vercel CI use AI_GATEWAY_API_KEY in
# .env.local or as a CI secret. See ADR 040.

module "vercel_project" {
  source = "../../modules/vercel-project"

  team_id           = trimspace(var.vercel_team_id) == "" ? null : var.vercel_team_id
  project_name      = var.project_name
  github_repository = var.github_repository
  production_branch = var.production_branch
  framework         = "nextjs"
  build_command     = "pnpm build && pnpm db:migrate:deploy && pnpm db:seed"
  # The Next.js app lives at apps/web/ in this pnpm monorepo (ADR 046).
  # Vercel detects the workspace root automatically by walking up for
  # pnpm-workspace.yaml, so `pnpm install` still runs at the repo root and
  # the lockfile is honoured.
  root_directory        = "apps/web"
  domain                = var.production_domain
  environment_variables = local.production_environment_variables
}
