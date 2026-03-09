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
  description = "Existing Vercel project name managed by production stack."
  type        = string
  default     = "travel-planner"
}

variable "open_previews" {
  description = "Map of open PR numbers to branch names."
  type        = map(string)
  default     = {}
}

variable "preview_auth_secret" {
  description = "Auth.js secret used by preview deployments."
  type        = string
  sensitive   = true
}

variable "preview_auth_url" {
  description = "Optional auth base URL used for preview deployments."
  type        = string
  default     = ""
}

variable "neon_region_id" {
  description = "Optional Neon region for preview project."
  type        = string
  default     = null
}

variable "sentry_dsn_public" {
  description = "Sentry public DSN to inject into preview deployments as NEXT_PUBLIC_SENTRY_DSN. Read from prod stack output after first apply."
  type        = string
  default     = ""
}

variable "sentry_org" {
  description = "Sentry organisation slug."
  type        = string
  default     = ""
}

variable "sentry_project" {
  description = "Sentry project slug."
  type        = string
  default     = ""
}

variable "sentry_auth_token" {
  description = "Sentry auth token for build-time source map upload in preview deployments."
  type        = string
  sensitive   = true
  default     = ""
}

