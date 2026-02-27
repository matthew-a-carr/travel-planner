resource "neon_project" "this" {
  name       = var.project_name
  region_id  = var.region_id
  pg_version = var.pg_version

  # Configure the default branch's database and role at project creation time.
  # These values cannot be changed after creation without recreating the project
  # (and losing all data). terraform plan will show "must be replaced" if they change.
  branch {
    database_name = var.database_name
    role_name     = var.role_name
  }
}
