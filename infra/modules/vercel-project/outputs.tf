output "project_id" {
  description = "Vercel project ID."
  value       = vercel_project.this.id
}

output "project_name" {
  description = "Vercel project name."
  value       = vercel_project.this.name
}

output "domain" {
  description = "Configured production domain, if any."
  value       = var.domain
}
