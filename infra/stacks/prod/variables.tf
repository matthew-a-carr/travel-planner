variable "vercel_api_token" {
  description = "Vercel API token used by Terraform provider."
  type        = string
  sensitive   = true
}

variable "vercel_team_id" {
  description = "Optional Vercel team ID. Leave null for personal account scope."
  type        = string
  default     = null
}

variable "neon_api_key" {
  description = "Neon API key used by Terraform provider."
  type        = string
  sensitive   = true
}

variable "neon_org_id" {
  description = "Optional Neon organization ID."
  type        = string
  default     = null
}

variable "project_name" {
  description = "Shared Vercel project name."
  type        = string
  default     = "travel-planner"
}

variable "github_repository" {
  description = "GitHub repository slug in owner/repo format."
  type        = string
  default     = "matthew-a-carr/travel-planner"
}

variable "production_branch" {
  description = "Branch that triggers production deployments."
  type        = string
  default     = "main"
}

variable "production_domain" {
  description = "Production domain name for the app."
  type        = string
  default     = "travel.matthewcarr.dev"
}

variable "auth_secret" {
  description = "Auth.js secret for production deployments."
  type        = string
  sensitive   = true
}

variable "auth_google_id" {
  description = "Google OAuth client ID for production SSO."
  type        = string
  sensitive   = true
}

variable "auth_google_secret" {
  description = "Google OAuth client secret for production SSO."
  type        = string
  sensitive   = true
}

variable "auth_self_registration_enabled" {
  description = "Whether production auto-approves first-time sign-ins."
  type        = bool
  default     = false
}

variable "auth_admin_emails" {
  description = "Comma-separated app admin emails for production bootstrap."
  type        = string
  default     = ""
}

variable "neon_region_id" {
  description = "Optional Neon region for production project."
  type        = string
  default     = null
}
