output "postgres_url" {
  description = "PostgreSQL connection string for the preview Neon database. Copy this value and set it as the preview_postgres_url sensitive variable in the travel-planner-production HCP Terraform workspace."
  value       = module.db.connection_string
  sensitive   = true
}

output "neon_project_id" {
  description = "The preview Neon project ID."
  value       = module.db.project_id
}
