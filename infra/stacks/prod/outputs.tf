output "vercel_project_id" {
  description = "Vercel project ID managed by production stack."
  value       = module.vercel_project.project_id
}

output "vercel_project_name" {
  description = "Vercel project name managed by production stack."
  value       = module.vercel_project.project_name
}

output "production_domain" {
  description = "Production domain assigned to the Vercel project."
  value       = module.vercel_project.domain
}

output "prod_postgres_url" {
  description = "Production database connection string."
  value       = module.neon.connection_uri
  sensitive   = true
}
