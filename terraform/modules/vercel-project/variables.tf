variable "project_name" {
  description = "Name of the Vercel project."
  type        = string
}

variable "github_repo" {
  description = "GitHub repository in owner/name format (e.g. matthew-a-carr/travel-planner)."
  type        = string
}

variable "production_postgres_url" {
  description = "PostgreSQL connection string for production Vercel deployments."
  type        = string
  sensitive   = true
}

variable "preview_postgres_url" {
  description = "PostgreSQL connection string for Vercel preview (PR) deployments. Must point to an isolated non-production database so migration bugs in PRs cannot affect production."
  type        = string
  sensitive   = true
}

variable "auth_secret" {
  description = "AUTH_SECRET for Auth.js — used to sign session tokens. Generate with: openssl rand -base64 32"
  type        = string
  sensitive   = true
}

variable "auth_google_id" {
  description = "Google OAuth 2.0 Client ID for Auth.js."
  type        = string
  sensitive   = true
}

variable "auth_google_secret" {
  description = "Google OAuth 2.0 Client Secret for Auth.js."
  type        = string
  sensitive   = true
}
