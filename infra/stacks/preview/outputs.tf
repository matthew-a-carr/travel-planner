output "preview_neon_project_id" {
  description = "Neon project ID used for preview branches."
  value       = module.neon.project_id
}

output "preview_branch_ids" {
  description = "Neon branch IDs keyed by PR number."
  value       = module.preview_branches.branch_ids
}

output "preview_postgres_urls" {
  description = "Preview DB connection strings keyed by PR number."
  value       = module.preview_branches.postgres_urls
  sensitive   = true
}
