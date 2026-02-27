output "connection_string" {
  description = "Pooled PostgreSQL connection string for use as POSTGRES_URL. Uses the PgBouncer pooler endpoint required for Vercel serverless functions."
  # connection_uri_pooler does not include a query string, so we append
  # ?sslmode=require explicitly. Neon enforces TLS server-side regardless, but
  # this matches the format Vercel Postgres would produce and satisfies the
  # postgres.js client's SSL negotiation expectations.
  value     = "${neon_project.this.connection_uri_pooler}?sslmode=require"
  sensitive = true
}

output "project_id" {
  description = "The Neon project ID. Use this to locate the project in the Neon console."
  value       = neon_project.this.id
}

output "database_host_pooler" {
  description = "The pooled endpoint hostname (without credentials). Useful for debugging."
  value       = neon_project.this.database_host_pooler
}
