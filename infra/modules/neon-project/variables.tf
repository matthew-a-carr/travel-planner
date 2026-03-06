variable "project_name" {
  description = "Neon project name."
  type        = string
}

variable "org_id" {
  description = "Optional Neon organization ID."
  type        = string
  default     = null
}

variable "region_id" {
  description = "Optional Neon region ID."
  type        = string
  default     = null
}

variable "pg_version" {
  description = "Postgres major version for Neon project."
  type        = number
  default     = 17
}

variable "history_retention_seconds" {
  description = "Neon history retention in seconds (free plan max is 21600)."
  type        = number
  default     = 21600
}

variable "autoscaling_min_cu" {
  description = "Minimum autoscaling compute units."
  type        = number
  default     = 0.25
}

variable "autoscaling_max_cu" {
  description = "Maximum autoscaling compute units."
  type        = number
  default     = 1
}
