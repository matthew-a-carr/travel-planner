# Dedicated Neon database for Vercel preview (PR) deployments.
#
# Vercel automatically creates a preview deployment for every pull request.
# These preview builds run `pnpm db:migrate && pnpm build` against this database,
# not the production database. If a migration script has a bug it will fail the
# preview build without affecting production.
#
# This environment must be applied before environments/production.
# After applying, copy the postgres_url output and set it as the
# preview_postgres_url variable in the travel-planner-production HCP workspace.

module "db" {
  source       = "../../modules/neon-database"
  project_name = "travel-planner-preview"
}
