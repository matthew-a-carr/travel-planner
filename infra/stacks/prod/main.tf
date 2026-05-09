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

  ai_gateway_environment_variable = trimspace(var.ai_gateway_api_key) == "" ? [] : [
    {
      key       = "AI_GATEWAY_API_KEY"
      value     = var.ai_gateway_api_key
      target    = toset(["production"])
      sensitive = true
      comment   = "Managed by Terraform: Vercel AI Gateway key for itinerary parsing + timeline insights"
    },
  ]
}

module "vercel_project" {
  source = "../../modules/vercel-project"

  team_id           = trimspace(var.vercel_team_id) == "" ? null : var.vercel_team_id
  project_name      = var.project_name
  github_repository = var.github_repository
  production_branch = var.production_branch
  framework         = "nextjs"
  build_command     = "pnpm build && pnpm db:migrate:deploy && pnpm db:seed"
  domain            = var.production_domain
  environment_variables = concat(
    local.production_environment_variables,
    local.ai_gateway_environment_variable,
  )
}
