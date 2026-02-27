# ── Auth secret ───────────────────────────────────────────────────────────────
# Generated once on first apply and stored in Terraform state (held securely
# in HCP Terraform). Invalidating this value signs out all active sessions.

resource "random_password" "auth_secret" {
  length  = 44    # produces ~32 bytes of base64-encoded output, matching `openssl rand -base64 32`
  special = false # [A-Za-z0-9] only — safe for all environment variable consumers
}

# ── Production database ───────────────────────────────────────────────────────

module "db" {
  source       = "../../modules/neon-database"
  project_name = "travel-planner-production"
}

# ── Vercel project ────────────────────────────────────────────────────────────
# Creates the Vercel project and sets environment variables for both production
# and preview targets. The preview target points to the isolated preview Neon
# project (managed separately in environments/preview) so PR preview builds
# cannot corrupt the production database.

module "app" {
  source = "../../modules/vercel-project"

  project_name            = "travel-planner"
  github_repo             = "matthew-a-carr/travel-planner"
  production_postgres_url = module.db.connection_string
  preview_postgres_url    = var.preview_postgres_url
  auth_secret             = random_password.auth_secret.result
  auth_google_id          = var.auth_google_id
  auth_google_secret      = var.auth_google_secret
}
