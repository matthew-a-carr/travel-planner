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

variable "resend_api_key" {
  description = "Resend API key used for production invite email delivery."
  type        = string
  sensitive   = true
}

variable "email_from_address" {
  description = "From email address used for invite emails."
  type        = string
  default     = "hello@mail.matthewcarr.dev"
}

variable "email_from_name" {
  description = "From display name used for invite emails."
  type        = string
  default     = "Travel Planner"
}

variable "neon_region_id" {
  description = "Optional Neon region for production project."
  type        = string
  default     = null
}

variable "sentry_auth_token" {
  description = "Sentry auth token used by Terraform provider and as build-time SENTRY_AUTH_TOKEN for source map upload."
  type        = string
  sensitive   = true
}

variable "sentry_org" {
  description = "Sentry organisation slug."
  type        = string
}

variable "sentry_team" {
  description = "Sentry team slug to assign to the project."
  type        = string
}

variable "ai_gateway_model" {
  description = "Model id (provider/model) for AI Gateway calls, set as AI_GATEWAY_MODEL. Change here to switch models without a code change. See ADR 040."
  type        = string
  default     = "openai/gpt-5.4-mini"
}

