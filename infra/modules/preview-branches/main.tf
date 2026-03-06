locals {
  previews = {
    for pr_number, branch_name in var.open_previews : tostring(pr_number) => {
      git_branch_name = branch_name
      neon_branch     = substr("pr-${pr_number}", 0, 63)
      role_name       = "pr_${pr_number}_app"
      database_name   = var.database_name
    }
  }
}

resource "neon_branch" "preview" {
  for_each = local.previews

  project_id = var.project_id
  name       = each.value.neon_branch
}

resource "neon_endpoint" "preview" {
  for_each = local.previews

  project_id              = var.project_id
  branch_id               = neon_branch.preview[each.key].id
  type                    = var.endpoint_type
  pooler_enabled          = true
  pooler_mode             = "transaction"
  suspend_timeout_seconds = 300
}

resource "neon_role" "preview" {
  for_each = local.previews

  project_id = var.project_id
  branch_id  = neon_branch.preview[each.key].id
  name       = each.value.role_name
}

resource "neon_database" "preview" {
  for_each = local.previews

  project_id = var.project_id
  branch_id  = neon_branch.preview[each.key].id
  name       = each.value.database_name
  owner_name = neon_role.preview[each.key].name
}

locals {
  preview_postgres_urls = {
    for pr_number, preview in local.previews :
    pr_number => format(
      "postgresql://%s:%s@%s/%s?sslmode=require",
      neon_role.preview[pr_number].name,
      urlencode(neon_role.preview[pr_number].password),
      neon_endpoint.preview[pr_number].host,
      neon_database.preview[pr_number].name,
    )
  }
}
