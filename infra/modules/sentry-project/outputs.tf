output "project_slug" {
  description = "The Sentry project slug."
  value       = sentry_project.this.slug
}

output "project_name" {
  description = "The Sentry project name."
  value       = sentry_project.this.name
}

output "dsn_public" {
  description = "The public DSN for this Sentry project. Inject as NEXT_PUBLIC_SENTRY_DSN."
  value       = data.sentry_key.default.dsn["public"]
  sensitive   = false
}
