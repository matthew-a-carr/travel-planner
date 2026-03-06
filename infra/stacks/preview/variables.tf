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

variable "preview_self_registration_enabled" {
  description = "Whether preview deployments auto-approve first-time sign-ins."
  type        = bool
  default     = true
}

variable "preview_auth_admin_emails" {
  description = "Comma-separated bootstrap admin emails for preview deployments."
  type        = string
  default     = ""
}

variable "neon_region_id" {
  description = "Optional Neon region for preview project."
  type        = string
  default     = null
}
