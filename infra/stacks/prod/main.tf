module "neon" {
  source = "../../modules/neon-project"

  project_name = "travel-planner-prod"
  org_id       = trimspace(var.neon_org_id) == "" ? null : var.neon_org_id
  region_id    = var.neon_region_id
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
  ]
}

module "vercel_project" {
  source = "../../modules/vercel-project"

  team_id               = trimspace(var.vercel_team_id) == "" ? null : var.vercel_team_id
  project_name          = var.project_name
  github_repository     = var.github_repository
  production_branch     = var.production_branch
  framework             = "nextjs"
  build_command         = "pnpm build && pnpm db:migrate:deploy"
  domain                = var.production_domain
  environment_variables = local.production_environment_variables
}
