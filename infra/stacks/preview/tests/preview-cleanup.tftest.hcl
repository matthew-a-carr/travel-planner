# Provider mocks keep this regression entirely local, including apply operations.
mock_provider "neon" {
  mock_resource "neon_endpoint" {
    defaults = { host = "preview.example.test" }
  }
  mock_resource "neon_role" {
    defaults = { password = "test-password" }
  }
}

mock_provider "vercel" {}

variables {
  vercel_api_token    = "test-only"
  vercel_team_id      = ""
  neon_api_key        = "test-only"
  neon_org_id         = ""
  preview_auth_secret = "test-only"
}

run "create_existing_preview" {
  command = apply
  variables {
    open_previews = { "170" = "feature/old" }
  }
}

run "remove_old_preview_before_creating_new_one" {
  command = apply
  variables {
    open_previews = { "208" = "feature/new" }
  }
  plan_options {
    target = [
      module.preview_branches.neon_branch.preview["170"],
      module.preview_branches.neon_endpoint.preview["170"],
      module.preview_branches.neon_role.preview["170"],
      module.preview_branches.neon_database.preview["170"],
      vercel_project_environment_variable.preview_postgres["170"],
    ]
  }
  assert {
    condition     = length(output.preview_postgres_urls) == 0
    error_message = "The cleanup pass must not construct URLs for previews outside its target set."
  }
}

run "create_new_preview_after_cleanup" {
  command = apply
  variables {
    open_previews = { "208" = "feature/new" }
  }
  assert {
    condition     = nonsensitive(output.preview_postgres_urls) == { "208" = "postgresql://pr_208_app:test-password@preview.example.test/travel_planner?sslmode=require" }
    error_message = "The full apply must provision the new preview and its database URL."
  }
}
