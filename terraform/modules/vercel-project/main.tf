resource "vercel_project" "this" {
  name      = var.project_name
  framework = "nextjs"

  git_repository = {
    type              = "github"
    repo              = var.github_repo
    production_branch = "main"
  }

  # Drizzle's migrate() is idempotent — it only applies unapplied migrations.
  # Vercel injects POSTGRES_URL before the build command runs, so migrations
  # execute against the correct database (production or preview) before next build.
  # No changes to src/infrastructure/db/migrate.ts are required.
  build_command   = "pnpm db:migrate && pnpm build"
  install_command = "pnpm install --frozen-lockfile"
}

# ── POSTGRES_URL ─────────────────────────────────────────────────────────────
# Two separate resources with different targets so preview deployments (PR
# builds) use an isolated Neon project and migration bugs cannot reach prod.

resource "vercel_project_environment_variable" "postgres_url_production" {
  project_id = vercel_project.this.id
  key        = "POSTGRES_URL"
  value      = var.production_postgres_url
  target     = ["production"]
  sensitive  = true
}

resource "vercel_project_environment_variable" "postgres_url_preview" {
  project_id = vercel_project.this.id
  key        = "POSTGRES_URL"
  value      = var.preview_postgres_url
  target     = ["preview"]
  sensitive  = true
}

# ── Auth.js credentials ───────────────────────────────────────────────────────
# Same values for both production and preview — session signing key and OAuth
# app are shared across environments for a personal single-user project.

resource "vercel_project_environment_variable" "auth_secret" {
  project_id = vercel_project.this.id
  key        = "AUTH_SECRET"
  value      = var.auth_secret
  target     = ["production", "preview"]
  sensitive  = true
}

resource "vercel_project_environment_variable" "auth_google_id" {
  project_id = vercel_project.this.id
  key        = "AUTH_GOOGLE_ID"
  value      = var.auth_google_id
  target     = ["production", "preview"]
  sensitive  = true
}

resource "vercel_project_environment_variable" "auth_google_secret" {
  project_id = vercel_project.this.id
  key        = "AUTH_GOOGLE_SECRET"
  value      = var.auth_google_secret
  target     = ["production", "preview"]
  sensitive  = true
}
