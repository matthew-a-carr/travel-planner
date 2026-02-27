variable "neon_api_key" {
  description = "Neon API key. Generate at: https://console.neon.tech/app/settings/api-keys"
  type        = string
  sensitive   = true
}

variable "vercel_api_token" {
  description = "Vercel API token. Generate at: https://vercel.com/account/tokens"
  type        = string
  sensitive   = true
}

variable "auth_google_id" {
  description = "Google OAuth 2.0 Client ID. Create credentials at: https://console.cloud.google.com/apis/credentials — Authorised redirect URIs must include https://<your-domain>/api/auth/callback/google"
  type        = string
  sensitive   = true
}

variable "auth_google_secret" {
  description = "Google OAuth 2.0 Client Secret."
  type        = string
  sensitive   = true
}

variable "preview_postgres_url" {
  description = "PostgreSQL connection string for Vercel preview (PR) deployments. Copy the postgres_url output from the travel-planner-preview HCP Terraform workspace after applying that environment first."
  type        = string
  sensitive   = true
}
