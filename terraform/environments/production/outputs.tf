output "vercel_project_url" {
  description = "The canonical Vercel deployment URL."
  value       = module.app.project_url
}

output "neon_project_id" {
  description = "The production Neon project ID. Use this to locate the project in the Neon console."
  value       = module.db.project_id
}

output "neon_database_host_pooler" {
  description = "The pooled Neon endpoint hostname (without credentials). Useful for debugging."
  value       = module.db.database_host_pooler
}
