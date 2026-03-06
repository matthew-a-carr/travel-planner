output "project_id" {
  description = "Neon project ID."
  value       = neon_project.this.id
}

output "default_branch_id" {
  description = "Neon default branch ID."
  value       = neon_project.this.default_branch_id
}

output "connection_uri" {
  description = "Direct connection string for default branch."
  value       = neon_project.this.connection_uri
  sensitive   = true
}

output "connection_uri_pooler" {
  description = "Connection string through Neon pooler for default branch."
  value       = neon_project.this.connection_uri_pooler
  sensitive   = true
}

output "database_host" {
  description = "Default branch hostname."
  value       = neon_project.this.database_host
}

output "database_name" {
  description = "Default database name."
  value       = neon_project.this.database_name
}

output "database_user" {
  description = "Default database role."
  value       = neon_project.this.database_user
}

output "database_password" {
  description = "Default database role password."
  value       = neon_project.this.database_password
  sensitive   = true
}
