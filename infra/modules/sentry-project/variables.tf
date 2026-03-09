variable "organization" {
  description = "Sentry organisation slug."
  type        = string
}

variable "team" {
  description = "Sentry team slug to assign to the project."
  type        = string
}

variable "project_name" {
  description = "Human-readable Sentry project name."
  type        = string
  default     = "travel-planner"
}

variable "project_slug" {
  description = "Sentry project slug. Defaults to project_name if not set."
  type        = string
  default     = null
}

variable "alert_environment" {
  description = "Sentry environment name used to scope production alerts."
  type        = string
  default     = "production"
}

variable "alert_notify_target_type" {
  description = "Target type for email notifications on issue alerts. Use 'Member' for individual members or 'Team' for a team."
  type        = string
  default     = "IssueOwners"
}
