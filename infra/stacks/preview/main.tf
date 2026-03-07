data "vercel_project" "this" {
  team_id = trimspace(var.vercel_team_id) == "" ? null : var.vercel_team_id
  name    = var.project_name
}

module "neon" {
  source = "../../modules/neon-project"

  project_name = "travel-planner-preview"
  org_id       = trimspace(var.neon_org_id) == "" ? null : var.neon_org_id
  region_id    = var.neon_region_id
}

module "preview_branches" {
  source = "../../modules/preview-branches"

  project_id    = module.neon.project_id
  open_previews = var.open_previews
}

locals {
  preview_environment_variables = {
    "AUTH_SECRET" = {
      value     = var.preview_auth_secret
      sensitive = true
      comment   = "Managed by Terraform: preview Auth.js secret"
    }
    "AUTH_TRUST_HOST" = {
      value     = "true"
      sensitive = false
      comment   = "Managed by Terraform: trust dynamic preview hosts for Auth.js"
    }
    "AUTH_ENABLE_LOCAL_DEV" = {
      value     = "true"
      sensitive = false
      comment   = "Managed by Terraform: enable local-dev auth in preview"
    }
    "EMAIL_FROM_ADDRESS" = {
      value     = "hello@mail.matthewcarr.dev"
      sensitive = false
      comment   = "Managed by Terraform: preview invite sender address (logging provider)"
    }
    "EMAIL_FROM_NAME" = {
      value     = "Travel Planner"
      sensitive = false
      comment   = "Managed by Terraform: preview invite sender name (logging provider)"
    }
  }

  preview_postgres_urls = nonsensitive(module.preview_branches.postgres_urls)
}

resource "vercel_project_environment_variable" "preview_static" {
  for_each = local.preview_environment_variables

  team_id    = trimspace(var.vercel_team_id) == "" ? null : var.vercel_team_id
  project_id = data.vercel_project.this.id
  key        = each.key
  value      = each.value.value
  target     = ["preview"]
  sensitive  = each.value.sensitive
  comment    = each.value.comment
}

resource "vercel_project_environment_variable" "preview_auth_url" {
  count = trimspace(var.preview_auth_url) == "" ? 0 : 1

  team_id    = trimspace(var.vercel_team_id) == "" ? null : var.vercel_team_id
  project_id = data.vercel_project.this.id
  key        = "AUTH_URL"
  value      = var.preview_auth_url
  target     = ["preview"]
  sensitive  = false
  comment    = "Managed by Terraform: preview auth URL"
}

resource "vercel_project_environment_variable" "preview_default_postgres" {
  team_id    = trimspace(var.vercel_team_id) == "" ? null : var.vercel_team_id
  project_id = data.vercel_project.this.id
  key        = "POSTGRES_URL"
  value      = module.neon.connection_uri
  target     = ["preview"]
  sensitive  = true
  comment    = "Managed by Terraform: default Neon DB URL for non-PR preview branches"
}

resource "vercel_project_environment_variable" "preview_postgres" {
  for_each = local.preview_postgres_urls

  team_id    = trimspace(var.vercel_team_id) == "" ? null : var.vercel_team_id
  project_id = data.vercel_project.this.id
  key        = "POSTGRES_URL"
  value      = each.value
  target     = ["preview"]
  sensitive  = true
  git_branch = module.preview_branches.git_branch_names[each.key]
  comment    = "Managed by Terraform: Neon preview branch DB URL"
}
