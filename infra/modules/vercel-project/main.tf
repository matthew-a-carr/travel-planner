locals {
  environment_variable_map = {
    for index, env in var.environment_variables : "${env.key}-${index}" => env
  }
}

resource "vercel_project" "this" {
  team_id                                           = var.team_id
  name                                              = var.project_name
  framework                                         = var.framework
  build_command                                     = var.build_command
  automatically_expose_system_environment_variables = true

  git_repository = {
    type              = "github"
    repo              = var.github_repository
    production_branch = var.production_branch
  }
}

resource "vercel_project_domain" "this" {
  count = var.domain == null ? 0 : 1

  team_id    = var.team_id
  project_id = vercel_project.this.id
  domain     = var.domain
}

resource "vercel_project_environment_variable" "this" {
  for_each = local.environment_variable_map

  team_id                = var.team_id
  project_id             = vercel_project.this.id
  key                    = each.value.key
  value                  = each.value.value
  target                 = try(each.value.target, null)
  custom_environment_ids = try(each.value.custom_environment_ids, null)
  git_branch             = try(each.value.git_branch, null)
  sensitive              = try(each.value.sensitive, true)
  comment                = try(each.value.comment, null)
}
